<?php

declare(strict_types=1);

namespace Kidepik\Shared\Logging;

final class LogLevel
{
    public const DEBUG = 'debug';
    public const INFO = 'info';
    public const NOTICE = 'notice';
    public const WARNING = 'warning';
    public const ERROR = 'error';

    /** @return array<string, int> */
    public static function ranks(): array
    {
        return [
            self::DEBUG => 10,
            self::INFO => 20,
            self::NOTICE => 30,
            self::WARNING => 40,
            self::ERROR => 50,
        ];
    }

    public static function normalize(string $level): string
    {
        $level = strtolower(trim($level));
        return isset(self::ranks()[$level]) ? $level : self::INFO;
    }
}
