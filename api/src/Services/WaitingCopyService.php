<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use PDO;

/**
 * Lotes de copy de espera generados por LLM (SPEC_APP_ADVENTURE_LLM_NARRATIVE §2.5).
 */
final class WaitingCopyService
{
    private const TTL_HOURS = 24;

    public function __construct(
        private readonly PDO $pdo,
        private readonly ?AdventureComposeService $compose = null,
    ) {
    }

    /**
     * Líneas en caché sin bloquear en LLM (respuesta rápida de sesión/turno).
     *
     * @return list<string>
     */
    public function cachedLines(string $childId, string $kind): array
    {
        try {
            $cached = $this->readCache($childId, $kind);

            return $cached !== null ? $cached['lines'] : [];
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * @return array{
     *   preparing_exam:list<string>,
     *   evaluating_answer:list<string>,
     *   adventure_compose:list<string>,
     *   general:list<string>
     * }
     */
    public function waitingCopyFromCache(string $childId): array
    {
        return [
            'preparing_exam' => $this->cachedLines($childId, 'preparing_exam'),
            'evaluating_answer' => $this->cachedLines($childId, 'evaluating_answer'),
            'adventure_compose' => $this->cachedLines($childId, 'adventure_compose'),
            'general' => $this->cachedLines($childId, 'general'),
        ];
    }

    /**
     * @param array<string,mixed> $child
     * @return array{lines:list<string>,kind:string,ttl_hours:int}
     */
    public function linesFor(
        string $childId,
        array $child,
        string $sessionId,
        string $kind,
    ): array {
        unset($sessionId);
        try {
            $cached = $this->readCache($childId, $kind);
            if ($cached !== null) {
                return $cached;
            }

            $compose = $this->compose ?? AdventureComposeService::fromConfig($this->pdo);
            $composed = $compose->composeWaitingBundle($childId, $child, $kind);
            $composed['ttl_hours'] = self::TTL_HOURS;
            $this->writeCache($childId, $kind, $composed);

            return $composed;
        } catch (AdventureComposeFailedException|\Throwable) {
            return ['lines' => [], 'kind' => $kind, 'ttl_hours' => self::TTL_HOURS];
        }
    }

    /**
     * @return array{lines:list<string>,kind:string,ttl_hours:int}|null
     */
    private function readCache(string $childId, string $kind): ?array
    {
        $stmt = $this->pdo->prepare('select settings from children where id = :id limit 1');
        $stmt->execute(['id' => $childId]);
        $raw = $stmt->fetchColumn();
        if (!is_string($raw)) {
            return null;
        }
        $settings = json_decode($raw, true);
        if (!is_array($settings)) {
            return null;
        }
        $cache = $settings['play_waiting_cache'] ?? null;
        if (!is_array($cache)) {
            return null;
        }
        $entry = $cache[$kind] ?? null;
        if (!is_array($entry)) {
            return null;
        }
        $at = strtotime((string) ($entry['generated_at'] ?? ''));
        $ttl = (int) ($entry['ttl_hours'] ?? self::TTL_HOURS);
        if ($at === false || (time() - $at) > $ttl * 3600) {
            return null;
        }
        $lines = $entry['lines'] ?? [];
        if (!is_array($lines) || $lines === []) {
            return null;
        }

        return [
            'lines' => array_values(array_filter($lines, static fn ($l): bool => is_string($l) && $l !== '')),
            'kind' => $kind,
            'ttl_hours' => $ttl,
        ];
    }

    /**
     * @param array{lines:list<string>,kind:string,ttl_hours:int} $bundle
     */
    private function writeCache(string $childId, string $kind, array $bundle): void
    {
        $stmt = $this->pdo->prepare('select settings from children where id = :id limit 1');
        $stmt->execute(['id' => $childId]);
        $raw = $stmt->fetchColumn();
        $settings = is_string($raw) ? json_decode($raw, true) : [];
        if (!is_array($settings)) {
            $settings = [];
        }
        $cache = is_array($settings['play_waiting_cache'] ?? null) ? $settings['play_waiting_cache'] : [];
        $cache[$kind] = [
            'generated_at' => gmdate('c'),
            'ttl_hours' => $bundle['ttl_hours'],
            'lines' => $bundle['lines'],
        ];
        $settings['play_waiting_cache'] = $cache;
        $this->pdo->prepare('update children set settings = :s::jsonb, updated_at = now() where id = :id')
            ->execute([
                's' => json_encode($settings, JSON_UNESCAPED_UNICODE),
                'id' => $childId,
            ]);
    }
}
