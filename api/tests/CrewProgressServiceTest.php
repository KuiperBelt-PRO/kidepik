<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Services\CrewProgressService;
use PHPUnit\Framework\TestCase;

final class CrewProgressServiceTest extends TestCase
{
    public function testPercentAt80Rolling(): void
    {
        $svc = new CrewProgressService($this->sqliteMinimal());
        $ref = new \ReflectionClass($svc);
        $method = $ref->getMethod('levelProgress');
        $method->setAccessible(true);
        /** @var array{percent_to_next:int,next:?string} $out */
        $out = $method->invoke($svc, 'L2', 0.80, 4, 'Matemáticas');
        self::assertSame(100, $out['percent_to_next']);
        self::assertSame('L3', $out['next']);
    }

    public function testZoneStatusCompleted(): void
    {
        $svc = new CrewProgressService($this->sqliteMinimal());
        $ref = new \ReflectionClass($svc);
        $method = $ref->getMethod('zoneStatus');
        $method->setAccessible(true);
        $status = $method->invoke($svc, 'L2', 'zone_math', ['zone_math'], null, null);
        self::assertSame('completed', $status);
    }

    public function testUnevaluatedSubject(): void
    {
        $svc = new CrewProgressService($this->sqliteMinimal());
        $ref = new \ReflectionClass($svc);
        $method = $ref->getMethod('zoneStatus');
        $method->setAccessible(true);
        $status = $method->invoke($svc, null, 'zone_math', [], null, null);
        self::assertSame('not_evaluated', $status);
    }

    private function sqliteMinimal(): \PDO
    {
        $pdo = new \PDO('sqlite::memory:');
        $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $pdo->exec('create table user_subject_levels (
            child_id text, subject_id text, level_id text, accuracy_rolling real
        )');
        $pdo->exec('create table narrative_quests (
            id text, child_id text, zone_id text, title_child text, status text,
            steps_done int, steps_total int, updated_at text
        )');
        $pdo->exec('create table placement_exams (
            child_id text, status text, completed_at text
        )');

        return $pdo;
    }
}
