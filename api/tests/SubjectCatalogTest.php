<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use InvalidArgumentException;
use Kidepik\Shared\Ai\AgeBand;
use Kidepik\Shared\Ai\SubjectCatalog;
use PHPUnit\Framework\TestCase;

final class SubjectCatalogTest extends TestCase
{
    public function testCatalogHasFifteenSubjects(): void
    {
        $ids = SubjectCatalog::ids();
        self::assertCount(15, $ids);
        self::assertContains('math', $ids);
        self::assertContains('reading', $ids);
        self::assertContains('history', $ids);
        self::assertContains('mythology', $ids);
        self::assertContains('ethics', $ids);
        self::assertContains('finance', $ids);
        self::assertContains('politics', $ids);
        self::assertTrue(SubjectCatalog::isValid('arts'));
        self::assertFalse(SubjectCatalog::isValid('alchemy'));
    }

    public function testDefaultWeightsSumApproximatelyOne(): void
    {
        $sum = array_sum(SubjectCatalog::defaultWeights());
        self::assertEqualsWithDelta(1.0, $sum, 0.001);
    }

    public function testBaseSubjectsByBand(): void
    {
        $early = SubjectCatalog::baseSubjectsForBand(AgeBand::EARLY);
        self::assertSame(
            ['math', 'language', 'logic', 'science', 'arts', 'communication'],
            $early,
        );

        $child = SubjectCatalog::baseSubjectsForBand(AgeBand::CHILD);
        self::assertContains('reading', $child);
        self::assertContains('sports', $child);
        self::assertNotContains('politics', $child);

        $tween = SubjectCatalog::baseSubjectsForBand(AgeBand::TWEEN);
        self::assertCount(13, $tween);
        self::assertContains('history', $tween);
        self::assertContains('mythology', $tween);
        self::assertContains('ethics', $tween);
        self::assertNotContains('politics', $tween);

        $teen = SubjectCatalog::baseSubjectsForBand(AgeBand::TEEN);
        self::assertContains('politics', $teen);
        self::assertContains('finance', $teen);

        $adult = SubjectCatalog::baseSubjectsForBand(AgeBand::ADULT);
        $senior = SubjectCatalog::baseSubjectsForBand(AgeBand::SENIOR);
        self::assertSame(SubjectCatalog::ids(), $adult);
        self::assertSame($adult, $senior);
    }

    public function testNormalizeActiveSubjectsFiltersAndDedupes(): void
    {
        $out = SubjectCatalog::normalizeActiveSubjects(['math', 'math', 'bogus', 'ethics', '']);
        self::assertSame(['math', 'ethics'], $out);
    }

    public function testNormalizeActiveSubjectsRequiresAtLeastOne(): void
    {
        $this->expectException(InvalidArgumentException::class);
        SubjectCatalog::normalizeActiveSubjects(['nope']);
    }

    public function testRenormalizeWeights(): void
    {
        $w = SubjectCatalog::renormalizeWeights(['math', 'language']);
        self::assertEqualsWithDelta(1.0, array_sum($w), 0.0001);
        self::assertEqualsWithDelta(0.5, $w['math'], 0.0001);
        self::assertEqualsWithDelta(0.5, $w['language'], 0.0001);
    }

    public function testSuggestActiveSubjectsMergesBandAndHousehold(): void
    {
        $suggested = SubjectCatalog::suggestActiveSubjects(
            AgeBand::EARLY,
            ['finance', 'math'],
        );
        self::assertContains('math', $suggested);
        self::assertContains('arts', $suggested);
        self::assertContains('finance', $suggested);
        self::assertSame($suggested, array_values(array_unique($suggested)));
    }

    public function testFamiliesGroupSubjects(): void
    {
        $families = SubjectCatalog::families();
        self::assertArrayHasKey('fundamentals', $families);
        self::assertContains('reading', $families['fundamentals']);
        self::assertContains('mythology', $families['humanities']);
        self::assertContains('history', $families['humanities']);
        self::assertContains('finance', $families['life']);
    }

    public function testDifficultyRangeForBand(): void
    {
        self::assertSame([1, 1], SubjectCatalog::difficultyRange(AgeBand::EARLY));
        self::assertSame([3, 5], SubjectCatalog::difficultyRange(AgeBand::ADULT));
        self::assertSame([2, 4], SubjectCatalog::difficultyRange(AgeBand::SENIOR));
    }

    public function testExtraChallengeSubjectsForBand(): void
    {
        self::assertSame([], SubjectCatalog::extraChallengeSubjects(AgeBand::CHILD));
        self::assertSame(['math', 'language'], SubjectCatalog::extraChallengeSubjects(AgeBand::TEEN));
        self::assertSame(['math', 'language'], SubjectCatalog::extraChallengeSubjects(AgeBand::ADULT));
    }

    public function testWordCountRangeForProse(): void
    {
        self::assertSame([20, 45], SubjectCatalog::proseWordRange(AgeBand::EARLY));
        self::assertSame([55, 120], SubjectCatalog::proseWordRange(AgeBand::ADULT));
        self::assertNotSame(
            SubjectCatalog::proseWordRange(AgeBand::TEEN),
            SubjectCatalog::proseWordRange(AgeBand::ADULT),
        );
    }
}
