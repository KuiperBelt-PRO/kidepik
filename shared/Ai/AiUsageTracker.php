<?php

declare(strict_types=1);

namespace Kidepik\Shared\Ai;

use Kidepik\Shared\Database\PdoFactory;
use PDO;
use PDOException;

/**
 * Persistencia mínima de uso IA exitoso en api_usage.
 */
final class AiUsageTracker
{
    public function __construct(private readonly ?PDO $pdo = null)
    {
    }

    /**
     * @param array{provider?:string,model?:string,usage?:array}|null $result
     */
    public function recordSuccess(
        string $purpose,
        ?string $childId,
        ?array $result,
    ): void {
        $pdo = $this->pdo ?? PdoFactory::fromConfig();
        if (!$pdo instanceof PDO) {
            return;
        }

        $usage = is_array($result['usage'] ?? null) ? $result['usage'] : [];
        $tokensIn = isset($usage['prompt_tokens']) ? (int) $usage['prompt_tokens'] : null;
        $tokensOut = isset($usage['completion_tokens']) ? (int) $usage['completion_tokens'] : null;
        $provider = (string) ($result['provider'] ?? 'openrouter');
        $model = (string) ($result['model'] ?? '');

        try {
            $stmt = $pdo->prepare(
                'insert into api_usage (child_id, purpose, provider, model, tokens_in, tokens_out)
                 values (:child_id, :purpose, :provider, :model, :tokens_in, :tokens_out)'
            );
            $stmt->execute([
                'child_id' => $childId,
                'purpose' => $purpose,
                'provider' => $provider,
                'model' => $model !== '' ? $model : null,
                'tokens_in' => $tokensIn,
                'tokens_out' => $tokensOut,
            ]);
        } catch (PDOException) {
            // Tabla no migrada u otro error: no bloquear el flujo principal.
        }
    }
}
