<?php

declare(strict_types=1);

namespace Kidepik\Shared\Text;

/**
 * Texto narrativo del personaje para tutor y prompts (evolutivo).
 */
final class CharacterSummaryBuilder
{
  /**
   * @param list<string> $features
   */
  public static function build(
    string $species,
    string $palette,
    array $features,
    ?string $vibe = null,
    ?string $explorerNote = null,
  ): string {
    $parts = [];

    $headline = trim($species);
    $paletteTrim = trim($palette);
    if ($headline !== '' && $paletteTrim !== '') {
      $parts[] = sprintf('%s de tono %s.', $headline, $paletteTrim);
    } elseif ($headline !== '') {
      $parts[] = $headline . '.';
    }

    $featureList = self::normalizeFeatures($features);
    if ($featureList !== []) {
      $parts[] = 'Rasgos: ' . implode(', ', $featureList) . '.';
    }

    $vibeTrim = trim((string) $vibe);
    if ($vibeTrim !== '') {
      $parts[] = 'Personalidad: ' . $vibeTrim . '.';
    }

    $note = self::normalizeExplorerNote($explorerNote, $species);
    if ($note !== null) {
      $parts[] = $note;
    }

    return trim(implode(' ', $parts));
  }

  /**
   * Añade logros o notas sin duplicar bloques idénticos.
   */
  public static function append(string $existing, string $append): string
  {
    $existing = trim($existing);
    $append = trim($append);
    if ($append === '') {
      return $existing;
    }
    if ($existing === '') {
      return $append;
    }
    if (str_contains(mb_strtolower($existing), mb_strtolower($append))) {
      return $existing;
    }

    return $existing . "\n\n" . $append;
  }

  /**
   * @param list<string> $features
   * @return list<string>
   */
  private static function normalizeFeatures(array $features): array
  {
    $out = [];
    foreach ($features as $feature) {
      if (!is_string($feature)) {
        continue;
      }
      $trimmed = trim($feature);
      if ($trimmed === '' || isset($out[$trimmed])) {
        continue;
      }
      $out[$trimmed] = true;
    }

    return array_keys($out);
  }

  private static function normalizeExplorerNote(?string $raw, string $species): ?string
  {
    if ($raw === null) {
      return null;
    }
    $raw = trim($raw);
    if ($raw === '') {
      return null;
    }

    $speciesNorm = mb_strtolower(trim($species));
    $rawNorm = mb_strtolower($raw);
    if ($rawNorm === $speciesNorm) {
      return null;
    }

    $soyPrefix = 'soy un ' . $speciesNorm;
    $soyPrefix2 = 'soy una ' . $speciesNorm;
    if ($rawNorm === $soyPrefix || $rawNorm === $soyPrefix2) {
      return null;
    }

    if (str_starts_with($rawNorm, $soyPrefix) && mb_strlen($raw) <= mb_strlen($species) + 12) {
      return null;
    }

    if (mb_strlen($raw) > 280) {
      $raw = mb_substr($raw, 0, 277) . '…';
    }

    return $raw;
  }
}
