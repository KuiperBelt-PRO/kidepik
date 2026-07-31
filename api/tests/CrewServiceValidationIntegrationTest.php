<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use InvalidArgumentException;
use Kidepik\Api\Services\CrewService;
use Kidepik\Api\Services\ParentAccountService;
use Kidepik\Shared\Config;
use Kidepik\Shared\Database\MigrationRunner;
use Kidepik\Shared\Database\PdoFactory;
use PDO;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/**
 * Validaciones de CrewService contra Postgres local.
 */
final class CrewServiceValidationIntegrationTest extends TestCase
{
    private ?PDO $pdo = null;

    /** @var list<string> */
    private array $authUserIds = [];

    protected function setUp(): void
    {
        $url = Config::databaseUrl();
        if ($url === null) {
            self::markTestSkipped('DATABASE_URL no configurada');
        }

        try {
            $this->pdo = PdoFactory::fromDatabaseUrl($url);
        } catch (\PDOException $e) {
            self::markTestSkipped('Postgres no alcanzable: ' . $e->getMessage());
        }

        MigrationRunner::fromEnv(dirname(__DIR__, 2))->ensureApplied();
    }

    protected function tearDown(): void
    {
        if ($this->pdo === null) {
            return;
        }

        foreach ($this->authUserIds as $authUserId) {
            $this->pdo->prepare('delete from public.parent_accounts where auth_user_id = :id')
                ->execute(['id' => $authUserId]);
            $this->pdo->prepare('delete from auth.users where id = :id')
                ->execute(['id' => $authUserId]);
        }
        $this->authUserIds = [];
    }

    private function seedParent(): array
    {
        $authUserId = bin2hex(random_bytes(16));
        $authUserId = substr($authUserId, 0, 8) . '-' . substr($authUserId, 8, 4) . '-4' . substr($authUserId, 12, 3)
            . '-a' . substr($authUserId, 15, 3) . '-' . substr($authUserId, 18, 12);
        $email = 'crew-val-' . bin2hex(random_bytes(3)) . '@test.local';

        $this->pdo->prepare(
            'insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
             values (:id, :email, crypt(:pwd, gen_salt(\'bf\')), now(), now(), now())',
        )->execute([
            'id' => $authUserId,
            'email' => $email,
            'pwd' => 'test-password-123',
        ]);
        $this->authUserIds[] = $authUserId;

        $parents = new ParentAccountService($this->pdo);
        $parents->bootstrap($authUserId, $email);

        return ['auth_user_id' => $authUserId, 'email' => $email, 'parents' => $parents];
    }

    public function testProfileTutorLabelClearsOnEmpty(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId, ['tutor_label' => 'Kid']);

        $updated = $crew->updateProfileForAuthUser($authUserId, $childId, ['tutor_label' => '   ']);

        self::assertNull($updated['settings']['tutor_label'] ?? null);
    }

    public function testProfileCharacterSummaryUpsertAndClear(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $summary = "Explorador spot de tono verde neón.\nRasgos: ojos redondos.";
        $updated = $crew->updateProfileForAuthUser($authUserId, $childId, [
            'character_summary' => $summary,
        ]);

        self::assertIsArray($updated['traits']);
        self::assertSame($summary, $updated['traits']['character_summary'] ?? null);

        $cleared = $crew->updateProfileForAuthUser($authUserId, $childId, [
            'character_summary' => '   ',
        ]);
        self::assertNull($cleared['traits']['character_summary'] ?? null);
    }

    public function testProfileCharacterSummaryTooLong(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $this->expectException(InvalidArgumentException::class);
        $crew->updateProfileForAuthUser($authUserId, $childId, [
            'character_summary' => str_repeat('a', 601),
        ]);
    }

    private function createMember(CrewService $crew, string $authUserId, array $payload = []): string
    {
        $created = $crew->createForAuthUser($authUserId, $payload);
        return (string) $created['id'];
    }

    public function testProfileValidationErrors(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $this->expectException(InvalidArgumentException::class);
        $crew->updateProfileForAuthUser($authUserId, $childId, ['age_years' => 3]);
    }

    public function testProfileInvalidStatus(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $this->expectException(InvalidArgumentException::class);
        $crew->updateProfileForAuthUser($authUserId, $childId, ['status' => 'gone']);
    }

    public function testProfileInvalidWorldTheme(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $this->expectException(InvalidArgumentException::class);
        $crew->updateProfileForAuthUser($authUserId, $childId, ['world_theme' => 'neon']);
    }

    public function testProfileWorldThemeLocked(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $this->expectException(InvalidArgumentException::class);
        $crew->updateProfileForAuthUser($authUserId, $childId, ['world_theme' => 'sci-fi']);
    }

    public function testProfileWorldThemeUnlock(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $updated = $crew->updateProfileForAuthUser($authUserId, $childId, [
            'world_theme' => 'sci-fi',
            'unlock_world' => true,
        ]);

        self::assertSame('sci-fi', $updated['world_theme']);
    }

    public function testProfileDisplayNameInvalid(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $this->expectException(InvalidArgumentException::class);
        $crew->updateProfileForAuthUser($authUserId, $childId, ['display_name' => 'bad@name']);
    }

    public function testProfileTutorLabelTooLong(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $this->expectException(InvalidArgumentException::class);
        $crew->updateProfileForAuthUser($authUserId, $childId, ['tutor_label' => str_repeat('a', 41)]);
    }

    public function testProfileNoFields(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $this->expectException(InvalidArgumentException::class);
        $crew->updateProfileForAuthUser($authUserId, $childId, []);
    }

    public function testCreateInvalidTutorLabelType(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);

        $this->expectException(InvalidArgumentException::class);
        $crew->createForAuthUser($ctx['auth_user_id'], ['tutor_label' => 123]);
    }

    public function testPermissionsBoolInvalid(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $this->expectException(InvalidArgumentException::class);
        $crew->updatePermissionsForAuthUser($authUserId, $childId, ['allow_solo_start' => 'yes']);
    }

    public function testPermissionsSessionLimitInvalid(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $this->expectException(InvalidArgumentException::class);
        $crew->updatePermissionsForAuthUser($authUserId, $childId, ['session_limit_per_day' => 20]);
    }

    public function testPermissionsMaxMinutesInvalid(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $this->expectException(InvalidArgumentException::class);
        $crew->updatePermissionsForAuthUser($authUserId, $childId, ['max_session_minutes' => 7]);
    }

    public function testPermissionsFontScaleInvalid(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $this->expectException(InvalidArgumentException::class);
        $crew->updatePermissionsForAuthUser($authUserId, $childId, ['font_scale_play' => 'xxl']);
    }

    public function testPermissionsExitPinInvalid(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $this->expectException(InvalidArgumentException::class);
        $crew->updatePermissionsForAuthUser($authUserId, $childId, ['exit_pin' => '12']);
    }

    public function testPermissionsClearExitPin(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $crew->updatePermissionsForAuthUser($authUserId, $childId, ['exit_pin' => '1234']);
        $cleared = $crew->updatePermissionsForAuthUser($authUserId, $childId, ['exit_pin' => null]);

        self::assertFalse($cleared['permissions']['exit_pin_set']);
    }

    public function testPermissionsCanChooseStoryBranch(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $updated = $crew->updatePermissionsForAuthUser($authUserId, $childId, [
            'can_choose_story_branch' => false,
        ]);

        self::assertFalse($updated['permissions']['can_choose_story_branch']);
    }

    public function testPermissionsNoFields(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $this->expectException(InvalidArgumentException::class);
        $crew->updatePermissionsForAuthUser($authUserId, $childId, []);
    }

    public function testAgeNineBand(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $updated = $crew->updateProfileForAuthUser($authUserId, $childId, ['age_years' => 10]);

        self::assertSame('band_child', $updated['age_band']);
    }

    public function testListForUnknownParentThrows(): void
    {
        $crew = new CrewService($this->pdo);

        $this->expectException(RuntimeException::class);
        $crew->listForAuthUser('00000000-0000-4000-a000-000000000000');
    }

    public function testCrewServiceWithoutInjectedPdo(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService();

        $list = $crew->listForAuthUser($ctx['auth_user_id']);

        self::assertSame(0, $list['member_count']);
    }

    public function testUnlockWorldThemeViaPermissions(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $crew->updatePermissionsForAuthUser($authUserId, $childId, ['lock_world_theme' => false]);
        $updated = $crew->updateProfileForAuthUser($authUserId, $childId, ['world_theme' => 'sci-fi']);

        self::assertSame('sci-fi', $updated['world_theme']);
    }

    public function testProfileDisplayNameTooLong(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $this->expectException(\InvalidArgumentException::class);
        $crew->updateProfileForAuthUser($authUserId, $childId, ['display_name' => str_repeat('a', 25)]);
    }

    public function testProfileReactivateAndClearWorldTheme(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $crew->updateProfileForAuthUser($authUserId, $childId, ['status' => 'paused']);
        $crew->updatePermissionsForAuthUser($authUserId, $childId, ['lock_world_theme' => false]);
        $active = $crew->updateProfileForAuthUser($authUserId, $childId, [
            'status' => 'active',
            'world_theme' => null,
        ]);

        self::assertSame('active', $active['status']);
        self::assertNull($active['world_theme']);
    }

    public function testListMapsSettingsJsonString(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId, ['tutor_label' => 'Scout']);

        $this->pdo->prepare(
            'update public.children set settings = :settings::jsonb where id = :id',
        )->execute([
            'settings' => json_encode(['tutor_label' => 'Scout'], JSON_THROW_ON_ERROR),
            'id' => $childId,
        ]);

        $list = $crew->listForAuthUser($authUserId);
        $member = null;
        foreach ($list['members'] as $row) {
            if (($row['id'] ?? '') === $childId) {
                $member = $row;
                break;
            }
        }

        self::assertNotNull($member);
        self::assertSame('Scout', $member['tutor_label']);
    }

    public function testProfileClearsAgeYears(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $crew->updateProfileForAuthUser($authUserId, $childId, ['age_years' => 9]);
        $cleared = $crew->updateProfileForAuthUser($authUserId, $childId, ['age_years' => null]);

        self::assertNull($cleared['age_years']);
    }

    public function testDetailIncludesExtendedProfileFields(): void
    {
        $ctx = $this->seedParent();
        $crew = new CrewService($this->pdo, $ctx['parents']);
        $authUserId = $ctx['auth_user_id'];
        $childId = $this->createMember($crew, $authUserId);

        $this->pdo->prepare(
            'update public.children
             set birth_year = 2015, effective_age_band = \'age_7\', locale = \'ca-ES\'
             where id = :id',
        )->execute(['id' => $childId]);

        $detail = $crew->getForAuthUser($authUserId, $childId);

        self::assertSame(2015, $detail['birth_year']);
        self::assertSame('age_7', $detail['effective_age_band']);
        self::assertSame('ca-ES', $detail['locale']);
    }
}
