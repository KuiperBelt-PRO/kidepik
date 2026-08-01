<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

use GuzzleHttp\Client;
use GuzzleHttp\Pool;
use GuzzleHttp\Psr7\Request;
use Kidepik\Shared\Config;
use Throwable;

/**
 * Varias llamadas chat/completions en paralelo (Guzzle Pool) para lotes de compose.
 */
final class ParallelLlmBatch
{
    /**
     * @param list<array{messages:list<array{role:string,content:string}>,opts?:array<string,mixed>}> $jobs
     * @return list<array{ok:bool,content?:string,error?:string,http_status?:int|null,latency_ms?:int}>
     */
    public static function chatMany(string $model, array $jobs): array
    {
        if ($jobs === []) {
            return [];
        }

        $key = Config::openRouterApiKey();
        if ($key === '') {
            return array_map(
                static fn (): array => ['ok' => false, 'error' => 'OPENROUTER_API_KEY missing', 'http_status' => 503],
                $jobs,
            );
        }

        $timeout = Config::aiTimeoutSeconds();
        $client = new Client([
            'timeout' => $timeout,
            'connect_timeout' => 10,
            'http_errors' => false,
        ]);
        $url = rtrim(Config::openRouterBaseUrl(), '/') . '/chat/completions';
        $headers = [
            'Authorization' => 'Bearer ' . $key,
            'Content-Type' => 'application/json',
            'HTTP-Referer' => Config::aiHttpReferer(),
            'X-Title' => Config::aiAppTitle(),
        ];

        $results = array_fill(0, count($jobs), ['ok' => false, 'error' => 'not started', 'http_status' => null]);
        $started = [];

        $requests = function () use ($jobs, $url, $headers, $model, &$started) {
            foreach ($jobs as $i => $job) {
                $started[$i] = hrtime(true);
                $payload = [
                    'model' => $model,
                    'messages' => $job['messages'],
                    'temperature' => $job['opts']['temperature'] ?? 0.68,
                ];
                if (isset($job['opts']['max_tokens'])) {
                    $payload['max_tokens'] = (int) $job['opts']['max_tokens'];
                }
                if (isset($job['opts']['response_format']) && is_array($job['opts']['response_format'])) {
                    $payload['response_format'] = $job['opts']['response_format'];
                }
                yield $i => new Request('POST', $url, $headers, json_encode($payload, JSON_THROW_ON_ERROR));
            }
        };

        $pool = new Pool($client, $requests(), [
            'concurrency' => max(1, count($jobs)),
            'fulfilled' => static function ($response, $index) use (&$results, &$started): void {
                $latency = isset($started[$index])
                    ? (int) round((hrtime(true) - $started[$index]) / 1_000_000)
                    : 0;
                $status = $response->getStatusCode();
                $body = (string) $response->getBody();
                if ($status < 200 || $status >= 300) {
                    $results[$index] = [
                        'ok' => false,
                        'error' => 'upstream HTTP ' . $status,
                        'http_status' => $status,
                        'latency_ms' => $latency,
                    ];

                    return;
                }
                $data = json_decode($body, true);
                $content = is_array($data) ? ($data['choices'][0]['message']['content'] ?? null) : null;
                if (!is_string($content) || trim($content) === '') {
                    $results[$index] = [
                        'ok' => false,
                        'error' => 'empty content from upstream',
                        'http_status' => $status,
                        'latency_ms' => $latency,
                    ];

                    return;
                }
                $results[$index] = [
                    'ok' => true,
                    'content' => $content,
                    'http_status' => $status,
                    'latency_ms' => $latency,
                ];
            },
            'rejected' => static function (Throwable $reason, $index) use (&$results, &$started): void {
                $latency = isset($started[$index])
                    ? (int) round((hrtime(true) - $started[$index]) / 1_000_000)
                    : 0;
                $results[$index] = [
                    'ok' => false,
                    'error' => 'transport error: ' . $reason->getMessage(),
                    'http_status' => null,
                    'latency_ms' => $latency,
                ];
            },
        ]);

        $pool->promise()->wait();

        return array_values($results);
    }
}
