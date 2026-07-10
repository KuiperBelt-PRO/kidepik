<?php

declare(strict_types=1);

namespace Kidepik\Api\Controllers;

use Kidepik\Api\Http\JsonResponse;
use Kidepik\Api\Services\AuthException;
use Kidepik\Api\Services\SupabaseAuthService;
use Kidepik\Shared\Storage\StorageDriverFactory;

final class StorageController
{
    public function __construct(private readonly ?SupabaseAuthService $auth = null)
    {
    }

    public function prepareUpload(?string $authorization, ?string $rawBody): JsonResponse
    {
        try {
            $claims = ($this->auth ?? new SupabaseAuthService())->validateBearer($authorization);
        } catch (AuthException $e) {
            return JsonResponse::error($e->getMessage(), 401);
        }

        /** @var array<string, mixed>|null $body */
        $body = $rawBody !== null && $rawBody !== '' ? json_decode($rawBody, true) : null;
        if (!is_array($body)) {
            return JsonResponse::error('Invalid JSON body', 422);
        }

        $filename = (string) ($body['filename'] ?? '');
        if ($filename === '') {
            return JsonResponse::error('filename is required', 422);
        }

        $category = (string) ($body['category'] ?? 'poc');

        try {
            $driver = StorageDriverFactory::create();
            $plan = $driver->prepareUpload($claims['sub'], $filename, $category);
        } catch (\InvalidArgumentException $e) {
            return JsonResponse::error($e->getMessage(), 422);
        } catch (\Throwable $e) {
            return JsonResponse::error($e->getMessage(), 500);
        }

        return JsonResponse::ok($plan->toArray());
    }

    public function upload(): JsonResponse
    {
        $token = (string) ($_POST['token'] ?? '');
        if ($token === '') {
            return JsonResponse::error('token is required', 422);
        }

        if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
            return JsonResponse::error('file is required', 422);
        }

        $file = $_FILES['file'];
        $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($error !== UPLOAD_ERR_OK) {
            return JsonResponse::error('upload failed with code ' . $error, 422);
        }

        $tmpName = (string) ($file['tmp_name'] ?? '');
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            return JsonResponse::error('invalid upload', 422);
        }

        try {
            $driver = StorageDriverFactory::create();
            $publicUrl = $driver->completeUpload($token, $tmpName);
        } catch (\Throwable $e) {
            return JsonResponse::error($e->getMessage(), 400);
        }

        return JsonResponse::ok(['public_url' => $publicUrl]);
    }
}
