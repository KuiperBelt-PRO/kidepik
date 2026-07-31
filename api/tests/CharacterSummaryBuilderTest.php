<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Shared\Text\CharacterSummaryBuilder;
use PHPUnit\Framework\TestCase;

final class CharacterSummaryBuilderTest extends TestCase
{
  public function testBuildFromTraitsStep(): void
  {
    $summary = CharacterSummaryBuilder::build(
      'Mago Aprendiz',
      'violeta y plata',
      ['ojos curiosos', 'silueta no humana'],
      null,
      'Soy un Mago, aprendiz. He tardado en descubrir que tengo capacidades mágicas y ya soy algo mayor',
    );

    self::assertStringContainsString('Mago Aprendiz de tono violeta y plata', $summary);
    self::assertStringContainsString('ojos curiosos', $summary);
    self::assertStringContainsString('capacidades mágicas', $summary);
  }

  public function testAppendAvoidsDuplicate(): void
  {
    $base = 'Mago Aprendiz de tono violeta y plata.';
    $merged = CharacterSummaryBuilder::append($base, 'Mago Aprendiz de tono violeta y plata.');
    self::assertSame($base, $merged);
  }
}
