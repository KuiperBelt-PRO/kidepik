<?php

declare(strict_types=1);

namespace Kidepik\Api\Controllers;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Kidepik\Api\Http\JsonResponse;
use Kidepik\Api\Services\DatabaseService;
use Kidepik\Shared\Config;
use Kidepik\Shared\Storage\StorageDriverFactory;

final class ArchitectureController
{
    public function __construct(
        private readonly ?Client $http = null,
        private readonly ?DatabaseService $database = null,
    ) {
    }

    public function config(): JsonResponse
    {
        return JsonResponse::ok([
            'api_url' => Config::publicApiUrl(),
            'supabase_url' => Config::publicSupabaseUrl(),
            'storage_public_url' => Config::mediaPublicBaseUrl(),
            'media_base_url' => Config::mediaPublicBaseUrl(),
            'note' => 'Same-origin app: web + API + /media on one host.',
        ]);
    }

    public function status(): JsonResponse
    {
        $supabaseOk = false;
        $supabaseDetail = 'unknown';

        $client = $this->http ?? new Client(['timeout' => 5.0]);
        try {
            $response = $client->get(Config::supabaseUrl() . '/rest/v1/');
            $supabaseOk = $response->getStatusCode() < 500;
            $supabaseDetail = 'http ' . $response->getStatusCode();
        } catch (GuzzleException $e) {
            $supabaseDetail = $e->getMessage();
        }

        $db = $this->database ?? new DatabaseService();
        $storage = StorageDriverFactory::create()->status();

        return JsonResponse::ok([
            'api' => ['ok' => true, 'service' => Config::appName()],
            'supabase' => ['ok' => $supabaseOk, 'detail' => $supabaseDetail],
            'postgres' => ['ok' => $db->isReachable()],
            'poc_health' => $db->pocHealthMessage(),
            'storage' => $storage,
        ]);
    }
}
