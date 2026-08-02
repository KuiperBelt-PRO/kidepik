<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use InvalidArgumentException;
use Kidepik\Api\Services\CrewService;
use Kidepik\Api\Services\DialogueService;
use PHPUnit\Framework\TestCase;
use RuntimeException;

final class DialogueHistoryTest extends TestCase
{
    private const CHILD_ID = '11111111-1111-1111-1111-111111111111';
    private const OPEN_SESSION_ID = '22222222-2222-2222-2222-222222222222';
    private const CLOSED_SESSION_ID = '33333333-3333-3333-3333-333333333333';

    public function testOpenSessionReturnsRecentWindowAcrossSessions(): void
    {
        $pdo = $this->sqliteMemory();
        $this->seedCrossSessionHistory($pdo, 30, 10);
        $service = $this->service($pdo);

        $result = $service->openSession('auth-user', self::CHILD_ID, 'adventure');

        self::assertCount(24, $result['turns']);
        self::assertTrue($result['history']['has_older']);
        self::assertNotEmpty($result['history']['oldest_turn_id']);
        self::assertSame(29, $result['pending_agent_turn']['sequence'] ?? null);
    }

    public function testLoadHistoryReturnsOlderChunkAcrossClosedSession(): void
    {
        $pdo = $this->sqliteMemory();
        $this->seedCrossSessionHistory($pdo, 30, 10);
        $service = $this->service($pdo);

        $opened = $service->openSession('auth-user', self::CHILD_ID, 'adventure');
        $beforeTurnId = (string) $opened['history']['oldest_turn_id'];
        $page = $service->loadHistory(
            'auth-user',
            self::CHILD_ID,
            self::OPEN_SESSION_ID,
            $beforeTurnId,
        );

        self::assertGreaterThanOrEqual(10, count($page['turns']));
        self::assertFalse($page['history']['has_older']);
    }

    public function testLoadHistoryRejectsMissingTurnId(): void
    {
        $pdo = $this->sqliteMemory();
        $this->seedCrossSessionHistory($pdo, 3, 0);
        $service = $this->service($pdo);

        $this->expectException(InvalidArgumentException::class);
        $service->loadHistory('auth-user', self::CHILD_ID, self::OPEN_SESSION_ID, '');
    }

    public function testLoadHistoryRejectsClosedSession(): void
    {
        $pdo = $this->sqliteMemory();
        $this->seedCrossSessionHistory($pdo, 3, 0, 'closed');
        $service = $this->service($pdo);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Dialogue session not found or closed');
        $service->loadHistory(
            'auth-user',
            self::CHILD_ID,
            self::OPEN_SESSION_ID,
            'turn-01',
        );
    }

    private function service(\PDO $pdo): DialogueService
    {
        $crew = $this->createMock(CrewService::class);
        $crew->method('getForAuthUser')->willReturn([
            'id' => self::CHILD_ID,
            'onboarding_step' => 'complete',
            'world_theme' => 'fantasy',
            'age_band' => 'band_child',
        ]);

        return new DialogueService($pdo, $crew);
    }

    private function sqliteMemory(): \PDO
    {
        $pdo = new \PDO('sqlite::memory:');
        $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $pdo->exec('create table dialogue_sessions (
            id text primary key,
            child_id text not null,
            flow_id text not null,
            mentor_id text not null,
            status text not null,
            created_at text default CURRENT_TIMESTAMP,
            updated_at text default CURRENT_TIMESTAMP
        )');
        $pdo->exec('create table dialogue_turns (
            id text primary key,
            session_id text not null,
            child_id text not null,
            flow_id text not null,
            sequence int not null,
            role text not null,
            text text not null,
            options text null,
            input_mode text null,
            explorer_reply text null,
            meta text not null default \'{}\',
            model_used text null,
            created_at text default CURRENT_TIMESTAMP
        )');

        return $pdo;
    }

    private function seedCrossSessionHistory(
        \PDO $pdo,
        int $openTurns,
        int $closedTurns,
        string $openStatus = 'open',
    ): void {
        $pdo->prepare(
            'insert into dialogue_sessions (id, child_id, flow_id, mentor_id, status)
             values (?, ?, ?, ?, ?)'
        )->execute([self::CLOSED_SESSION_ID, self::CHILD_ID, 'first_run', 'mentor_fantasy', 'closed']);

        $pdo->prepare(
            'insert into dialogue_sessions (id, child_id, flow_id, mentor_id, status)
             values (?, ?, ?, ?, ?)'
        )->execute([self::OPEN_SESSION_ID, self::CHILD_ID, 'adventure', 'mentor_fantasy', $openStatus]);

        $seq = 1;
        for ($i = 1; $i <= $closedTurns; $i++) {
            $this->insertTurn($pdo, self::CLOSED_SESSION_ID, 'first_run', $seq++, $i, '2026-01-01 10:' . sprintf('%02d', $i) . ':00');
        }
        for ($i = 1; $i <= $openTurns; $i++) {
            $role = $i % 2 === 0 ? 'explorer' : 'mentor';
            $this->insertTurn(
                $pdo,
                self::OPEN_SESSION_ID,
                'adventure',
                $i,
                $closedTurns + $i,
                '2026-01-02 10:' . sprintf('%02d', $i) . ':00',
                $role,
            );
        }
    }

    private function insertTurn(
        \PDO $pdo,
        string $sessionId,
        string $flowId,
        int $sequence,
        int $labelNum,
        string $createdAt,
        string $role = 'mentor',
    ): void {
        $pdo->prepare(
            'insert into dialogue_turns (
                id, session_id, child_id, flow_id, sequence, role, text, meta, created_at
             ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            sprintf('turn-%02d', $labelNum),
            $sessionId,
            self::CHILD_ID,
            $flowId,
            $sequence,
            $role,
            "Turno {$labelNum}",
            '{}',
            $createdAt,
        ]);
    }
}
