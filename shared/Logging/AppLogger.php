<?php

declare(strict_types=1);

namespace Kidepik\Shared\Logging;

use Kidepik\Shared\Config;

/**
 * Logger JSONL por canal bajo web/logs/ (no versionable).
 */
final class AppLogger
{
    /** @var array<string, self> */
    private static array $instances = [];

    private function __construct(private readonly string $channel)
    {
    }

    public static function channel(string $channel): self
    {
        $channel = self::normalizeChannel($channel);
        if (!isset(self::$instances[$channel])) {
            self::$instances[$channel] = new self($channel);
        }

        return self::$instances[$channel];
    }

    public static function resetForTests(): void
    {
        self::$instances = [];
    }

    /** @param array<string, mixed> $context */
    public function debug(string $message, array $context = []): void
    {
        $this->write(LogLevel::DEBUG, $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function info(string $message, array $context = []): void
    {
        $this->write(LogLevel::INFO, $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function notice(string $message, array $context = []): void
    {
        $this->write(LogLevel::NOTICE, $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function warning(string $message, array $context = []): void
    {
        $this->write(LogLevel::WARNING, $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function error(string $message, array $context = []): void
    {
        $this->write(LogLevel::ERROR, $message, $context);
    }

    /** @param array<string, mixed> $context */
    private function write(string $level, string $message, array $context): void
    {
        if (!Config::fileLoggingEnabled()) {
            return;
        }

        if (!$this->shouldLog($level)) {
            return;
        }

        $record = [
            'ts' => gmdate('Y-m-d\TH:i:s.u\Z'),
            'level' => $level,
            'channel' => $this->channel,
            'message' => $message,
            'context' => $this->sanitizeContext($context),
            'env' => Config::appEnv(),
        ];

        if (Config::aiDebugEnabled()) {
            $record['debug_ai'] = true;
        }

        $line = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($line === false) {
            return;
        }

        $path = $this->logFilePath();
        if ($path === null) {
            return;
        }

        file_put_contents($path, $line . "\n", FILE_APPEND | LOCK_EX);

        if ($level === LogLevel::ERROR || $level === LogLevel::WARNING) {
            error_log($line);
        }
    }

    private function shouldLog(string $level): bool
    {
        $ranks = LogLevel::ranks();
        $min = LogLevel::normalize($this->effectiveMinLevel());

        return ($ranks[$level] ?? 0) >= ($ranks[$min] ?? 20);
    }

    private function effectiveMinLevel(): string
    {
        if (Config::aiDebugEnabled() && in_array($this->channel, ['ai', 'compose', 'api', 'client'], true)) {
            return LogLevel::DEBUG;
        }

        return Config::logLevel();
    }

    private function logFilePath(): ?string
    {
        $dir = Config::logDir();
        if ($dir === '') {
            return null;
        }

        if (!is_dir($dir)) {
            if (!mkdir($dir, 0775, true) && !is_dir($dir)) {
                return null;
            }
        }

        $date = gmdate('Y-m-d');

        return rtrim($dir, '/\\') . DIRECTORY_SEPARATOR . $this->channel . '-' . $date . '.log';
    }

    private static function normalizeChannel(string $channel): string
    {
        $channel = strtolower(trim($channel));
        $channel = preg_replace('/[^a-z0-9_-]+/', '_', $channel) ?? 'app';

        return $channel !== '' ? $channel : 'app';
    }

    /**
     * @param array<string, mixed> $context
     * @return array<string, mixed>
     */
    private function sanitizeContext(array $context): array
    {
        $out = [];
        foreach ($context as $key => $value) {
            $k = strtolower((string) $key);
            if (in_array($k, [
                'authorization',
                'token',
                'access_token',
                'api_key',
                'openrouter_api_key',
                'password',
                'secret',
            ], true)) {
                $out[$key] = '[redacted]';

                continue;
            }

            if (is_string($value)) {
                $out[$key] = mb_strlen($value) > 800 ? mb_substr($value, 0, 800) . '…' : $value;

                continue;
            }

            if (is_array($value)) {
                $encoded = json_encode($value, JSON_UNESCAPED_UNICODE);
                if ($encoded !== false && strlen($encoded) > 4000) {
                    $out[$key] = mb_substr($encoded, 0, 4000) . '…';

                    continue;
                }
            }

            $out[$key] = $value;
        }

        return $out;
    }
}
