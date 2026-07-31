<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

use GuzzleHttp\Client;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Exception\GuzzleException;

/**
 * Cliente OpenAI-compatible (`POST {base}/chat/completions`).
 */
final class LLMClient
{
    private ClientInterface $http;

    /** @param array<string,string> $extraHeaders */
    public function __construct(
        private string $baseUrl,
        private string $apiKey,
        private int $timeout = 30,
        private array $extraHeaders = [],
        ?ClientInterface $http = null,
    ) {
        $this->http = $http ?? new Client(['timeout' => $this->timeout, 'connect_timeout' => 10]);
    }

    /**
     * @param list<array{role:string,content:string}> $messages
     * @param array{temperature?:float,max_tokens?:int,response_format?:array} $opts
     * @return array{content:string,usage?:array,raw_model?:string}
     */
    public function chat(string $model, array $messages, array $opts = []): array
    {
        $url = rtrim($this->baseUrl, '/') . '/chat/completions';
        $payload = [
            'model' => $model,
            'messages' => $messages,
            'temperature' => $opts['temperature'] ?? 0.5,
        ];
        if (isset($opts['max_tokens'])) {
            $payload['max_tokens'] = (int) $opts['max_tokens'];
        }
        if (isset($opts['response_format']) && is_array($opts['response_format'])) {
            $payload['response_format'] = $opts['response_format'];
        }

        $headers = array_merge([
            'Authorization' => 'Bearer ' . $this->apiKey,
            'Content-Type' => 'application/json',
        ], $this->extraHeaders);

        try {
            $response = $this->http->request('POST', $url, [
                'headers' => $headers,
                'json' => $payload,
                'http_errors' => false,
                'timeout' => $this->timeout,
            ]);
        } catch (GuzzleException $e) {
            throw new LLMException('transport error: ' . $e->getMessage(), 0);
        }

        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if ($status < 200 || $status >= 300) {
            throw new LLMException('upstream HTTP ' . $status, $status);
        }

        $data = json_decode($body, true);
        if (!is_array($data)) {
            throw new LLMException('invalid JSON from upstream', $status);
        }

        $content = $data['choices'][0]['message']['content'] ?? null;
        if (!is_string($content) || trim($content) === '') {
            throw new LLMException('empty content from upstream', $status);
        }

        $out = ['content' => trim($content)];
        if (isset($data['usage']) && is_array($data['usage'])) {
            $out['usage'] = $data['usage'];
        }
        if (isset($data['model']) && is_string($data['model'])) {
            $out['raw_model'] = $data['model'];
        }

        return $out;
    }
}
