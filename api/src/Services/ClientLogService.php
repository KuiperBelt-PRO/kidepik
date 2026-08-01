<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use Kidepik\Shared\Config;
use Kidepik\Shared\Logging\AppLogger;
use Kidepik\Shared\Logging\LogLevel;

final class ClientLogService
{
    private const MAX_EVENTS = 50;
    private const MAX_MESSAGE_LEN = 200;
    private const ALLOWED_LEVELS = [
        LogLevel::DEBUG,
        LogLevel::INFO,
        LogLevel::NOTICE,
        LogLevel::WARNING,
        LogLevel::ERROR,
    ];

    /**
     * @param array<string, mixed> $payload
     * @return array{accepted: int, rejected: int}
     */
    public function ingest(array $payload, ?string $authUserId = null): array
    {
        if (!Config::clientLogIngestEnabled()) {
            throw new ClientLogException('Client log ingest disabled', 404);
        }

        $events = $payload['events'] ?? null;
        if (!is_array($events)) {
            throw new ClientLogException('events array required', 422);
        }

        if (count($events) > self::MAX_EVENTS) {
            throw new ClientLogException('too many events', 422);
        }

        $logger = AppLogger::channel('client');
        $accepted = 0;
        $rejected = 0;

        foreach ($events as $event) {
            if (!is_array($event)) {
                $rejected++;

                continue;
            }

            $level = LogLevel::normalize((string) ($event['level'] ?? 'info'));
            if (!in_array($level, self::ALLOWED_LEVELS, true)) {
                $rejected++;

                continue;
            }

            $message = trim((string) ($event['message'] ?? ''));
            if ($message === '') {
                $rejected++;

                continue;
            }

            if (mb_strlen($message) > self::MAX_MESSAGE_LEN) {
                $message = mb_substr($message, 0, self::MAX_MESSAGE_LEN);
            }

            /** @var array<string, mixed> $context */
            $context = is_array($event['context'] ?? null) ? $event['context'] : [];
            if ($authUserId !== null) {
                $context['auth_user_id'] = $authUserId;
            }

            $clientTs = $event['client_ts'] ?? null;
            if (is_string($clientTs) && $clientTs !== '') {
                $context['client_ts'] = mb_substr($clientTs, 0, 40);
            }

            $context['source'] = 'web';

            match ($level) {
                LogLevel::DEBUG => $logger->debug($message, $context),
                LogLevel::INFO => $logger->info($message, $context),
                LogLevel::NOTICE => $logger->notice($message, $context),
                LogLevel::WARNING => $logger->warning($message, $context),
                LogLevel::ERROR => $logger->error($message, $context),
            };

            $accepted++;
        }

        return ['accepted' => $accepted, 'rejected' => $rejected];
    }
}
