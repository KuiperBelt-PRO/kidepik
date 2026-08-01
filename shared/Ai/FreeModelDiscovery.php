<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

use GuzzleHttp\Client;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Exception\GuzzleException;
use Kidepik\Shared\Config;

/**
 * Descubre modelos free vía GET /api/v1/models y los rankea.
 */
class FreeModelDiscovery
{
    public function __construct(
        private ?ClientInterface $http = null,
        private FreeModelCatalog $catalog = new FreeModelCatalog(),
        private FreeModelRanker $ranker = new FreeModelRanker(),
    ) {
    }

    /**
     * @param list<array<string,mixed>>|null $rawOverride fixture para tests
     * @return list<string> model ids ordenados
     */
    public function rankedIds(?array $rawOverride = null, string $purpose = 'dialogue'): array
    {
        $raw = $rawOverride ?? $this->fetchRaw();
        $free = $this->catalog->filterFree($raw, Config::aiModelDenylist());
        $profile = Config::aiUsesQualityFreeModels($purpose)
            ? FreeModelRanker::PROFILE_QUALITY
            : FreeModelRanker::PROFILE_DEFAULT;
        $ranked = $this->ranker->rank($free, Config::aiModelPreferenceSeed($purpose), $profile);

        return array_map(static fn (array $r): string => $r['id'], $ranked);
    }

    /** @return list<array<string,mixed>> */
    private function fetchRaw(): array
    {
        $key = Config::openRouterApiKey();
        if ($key === '') {
            return [];
        }

        $http = $this->http ?? new Client([
            'timeout' => Config::aiTimeoutSeconds(),
            'connect_timeout' => 10,
        ]);
        $url = Config::openRouterBaseUrl() . '/models?output_modalities=text';

        try {
            $response = $http->request('GET', $url, [
                'headers' => [
                    'Authorization' => 'Bearer ' . $key,
                    'HTTP-Referer' => Config::aiHttpReferer(),
                    'X-Title' => Config::aiAppTitle(),
                ],
                'http_errors' => false,
            ]);
        } catch (GuzzleException) {
            return [];
        }

        if ($response->getStatusCode() < 200 || $response->getStatusCode() >= 300) {
            return [];
        }

        $data = json_decode((string) $response->getBody(), true);
        if (!is_array($data) || !isset($data['data']) || !is_array($data['data'])) {
            return [];
        }

        /** @var list<array<string,mixed>> $list */
        $list = [];
        foreach ($data['data'] as $row) {
            if (is_array($row)) {
                $list[] = $row;
            }
        }

        return $list;
    }
}
