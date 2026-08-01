<?php

declare(strict_types=1);

namespace Kidepik\Api\Controllers;

use InvalidArgumentException;
use Kidepik\Api\Http\JsonResponse;
use Kidepik\Api\Services\AuthException;
use Kidepik\Api\Services\CrewService;
use Kidepik\Api\Services\DialogueService;
use Kidepik\Api\Services\JourneyMemoryService;
use Kidepik\Api\Services\JourneyTimelineService;
use Kidepik\Api\Services\ParentAccountService;
use Kidepik\Api\Services\SupabaseAuthService;
use Kidepik\Shared\Config;
use Kidepik\Shared\Database\PdoFactory;
use RuntimeException;
use Throwable;

final class PlayDialogueController
{
    public function __construct(
        private readonly ?SupabaseAuthService $auth = null,
        private readonly ?DialogueService $dialogue = null,
        private readonly ?ParentAccountService $parents = null,
    ) {
    }

    public function openSession(?string $authorization, string $childId, ?string $rawBody): JsonResponse
    {
        return $this->withParent($authorization, function (string $authUserId) use ($childId, $rawBody) {
            $payload = $this->decode($rawBody);
            $flowId = isset($payload['flow_id']) && is_string($payload['flow_id'])
                ? $payload['flow_id']
                : 'first_run';
            try {
                return JsonResponse::ok(
                    ($this->dialogue ?? new DialogueService())->openSession($authUserId, $childId, $flowId)
                );
            } catch (InvalidArgumentException $e) {
                return JsonResponse::error($e->getMessage(), 422);
            } catch (RuntimeException $e) {
                if ($e->getMessage() === 'Crew member not found') {
                    return JsonResponse::error($e->getMessage(), 404);
                }
                throw $e;
            }
        });
    }

    public function submitTurn(?string $authorization, string $childId, ?string $rawBody): JsonResponse
    {
        return $this->withParent($authorization, function (string $authUserId) use ($childId, $rawBody) {
            $payload = $this->decode($rawBody);
            $sessionId = isset($payload['session_id']) && is_string($payload['session_id'])
                ? $payload['session_id']
                : '';
            $reply = isset($payload['reply']) && is_array($payload['reply']) ? $payload['reply'] : null;
            if ($sessionId === '' || $reply === null) {
                return JsonResponse::error('session_id and reply required', 422);
            }
            try {
                /** @var array{kind:string,option_id?:string,text?:string} $reply */
                $attachDebug = Config::shouldAttachDebugResponse($_SERVER['HTTP_X_KIDEPIK_DEBUG_AI'] ?? null);

                return JsonResponse::ok(
                    ($this->dialogue ?? new DialogueService())->submitTurn(
                        $authUserId,
                        $childId,
                        $sessionId,
                        $reply,
                        $attachDebug,
                    )
                );
            } catch (InvalidArgumentException $e) {
                return JsonResponse::error($e->getMessage(), 422);
            } catch (RuntimeException $e) {
                if ($e->getMessage() === 'Crew member not found') {
                    return JsonResponse::error($e->getMessage(), 404);
                }
                throw $e;
            }
        });
    }

    public function journeySummary(?string $authorization, string $childId): JsonResponse
    {
        return $this->withParent($authorization, function (string $authUserId) use ($childId) {
            try {
                $crew = new CrewService();
                $crew->getForAuthUser($authUserId, $childId);
                $pdo = PdoFactory::fromConfig()
                    ?? throw new RuntimeException('DATABASE_URL not configured');
                $summary = (new JourneyMemoryService($pdo))->latestSummaryText($childId);

                return JsonResponse::ok([
                    'child_id' => $childId,
                    'summary' => $summary,
                    'kind' => 'condensed_full',
                ]);
            } catch (RuntimeException $e) {
                if ($e->getMessage() === 'Crew member not found') {
                    return JsonResponse::error($e->getMessage(), 404);
                }
                throw $e;
            }
        });
    }

    public function journeyTimeline(?string $authorization, string $childId): JsonResponse
    {
        return $this->withParent($authorization, function (string $authUserId) use ($childId) {
            try {
                $crew = new CrewService();
                $crew->getForAuthUser($authUserId, $childId);
                $pdo = PdoFactory::fromConfig()
                    ?? throw new RuntimeException('DATABASE_URL not configured');
                $cursor = isset($_GET['cursor']) && is_string($_GET['cursor']) ? $_GET['cursor'] : null;
                $limit = isset($_GET['limit']) && is_numeric($_GET['limit']) ? (int) $_GET['limit'] : 30;
                $page = (new JourneyTimelineService($pdo))->page($childId, $cursor, $limit);

                return JsonResponse::ok([
                    'child_id' => $childId,
                    ...$page,
                ]);
            } catch (RuntimeException $e) {
                if ($e->getMessage() === 'Crew member not found') {
                    return JsonResponse::error($e->getMessage(), 404);
                }
                throw $e;
            }
        });
    }

    /**
     * @param callable(string):JsonResponse $fn
     */
    private function withParent(?string $authorization, callable $fn): JsonResponse
    {
        try {
            $claims = ($this->auth ?? new SupabaseAuthService())->validateBearer($authorization);
        } catch (AuthException $e) {
            return JsonResponse::error($e->getMessage(), 401);
        }

        $email = $claims['email'] ?? '';
        if ($email === '') {
            return JsonResponse::error('Email required', 422);
        }

        try {
            ($this->parents ?? new ParentAccountService())->getOrBootstrap(
                $claims['sub'],
                $email,
                $claims['display_name'] ?? null,
                $claims['avatar_url'] ?? null,
            );

            return $fn($claims['sub']);
        } catch (RuntimeException $e) {
            $message = $e->getMessage();
            if ($message === 'DATABASE_URL not configured' || $message === 'Database unavailable') {
                return JsonResponse::error($message, 503);
            }

            return JsonResponse::error('Internal error', 500);
        } catch (Throwable) {
            return JsonResponse::error('Internal error', 500);
        }
    }

    /** @return array<string,mixed> */
    private function decode(?string $rawBody): array
    {
        if ($rawBody === null || trim($rawBody) === '') {
            return [];
        }
        $data = json_decode($rawBody, true);

        return is_array($data) ? $data : [];
    }
}
