# Spec: Efectos de objetos de equipaje (uso en viaje)

> Estado: **aprobada — implementada parcialmente (hint/retry)** (ago 2026)  
> Relacionado: [SPEC_APP_INVENTORY_BAGGAGE.md](SPEC_APP_INVENTORY_BAGGAGE.md), [SPEC_APP_ITEM_CATALOG.md](SPEC_APP_ITEM_CATALOG.md), [SPEC_APP_REWARDS_ECONOMY.md](SPEC_APP_REWARDS_ECONOMY.md), [SPEC_APP_ADVENTURE_SESSION.md](SPEC_APP_ADVENTURE_SESSION.md), [SPEC_APP_JOURNEY_MECHANICS.md](SPEC_APP_JOURNEY_MECHANICS.md)

## Contexto

Los objetos del equipaje deben **servir** en el viaje: pistas en retos, reintentos, y más adelante desbloqueos lúdicos o cosméticos de avatar. Esta spec fija el **contrato de efectos** sin obligar implementación completa el día 1.

## Objetivo

1. Enum de efectos y semántica.
2. API de uso y reglas de consumo.
3. Qué está **MVP-ready** vs **futuro**.
4. Límites anti-abuso pedagógicos.

---

## 1. Decisiones

| # | Decisión | Valor |
| --- | --- | --- |
| X1 | Consumo | Efectos `challenge_*` consumen **1** `qty` al confirmar uso |
| X2 | Materia | Solo si reto actual `subject_id ∈ item.subject_ids` y materia activa |
| X3 | Autoridad | Servidor valida; cliente solo solicita |
| X4 | MVP implementable | `challenge_hint`, `challenge_retry` |
| X5 | Futuro explícito | `skip_wait_token`, `unlock_minigame`, `avatar_cosmetic` |
| X6 | UI sin effect live | Botón «Usar» deshabilitado + `use_blocked_reason=Próximamente` |

---

## 2. Catálogo de efectos

| `ItemEffectId` | Fase | Entrada | Salida | Consume ítem |
| --- | --- | --- | --- | --- |
| `challenge_hint` | P2 | Reto activo pendiente | Texto pista **sin** revelar respuesta canónica; 1–3 frases | Sí |
| `challenge_retry` | P2 | Reto fallido en la sesión / nodo | Reabre el mismo reto (nuevo intento); no regenera camino entero | Sí |
| `skip_wait_token` | Futuro | Espera LLM activa | Acorta o salta rotación de frases | Sí |
| `unlock_minigame` | Futuro | Flag hijo | Habilita shell minijuego | No o sí según def |
| `avatar_cosmetic` | Futuro | Slot avatar | Desbloquea rasgo visual | No (unlock permanente en meta) |

---

## 3. API de uso

```http
POST /api/v1/play/{child_id}/baggage/{item_row_id}/use
{ "effect_id": "challenge_hint", "session_id": "...", "challenge_ref": "..." }
```

Respuesta OK:

```ts
interface UseItemResult {
  ok: true;
  effect_id: ItemEffectId;
  consumed_qty: number;
  baggage: BaggageDto;          // actualizado
  hint_text?: string;           // si challenge_hint
  challenge_reopened?: boolean;
  mentor_line?: string;         // 1 frase diegética opcional
}
```

Errores:

| Status | Código lógico | Cuándo |
| --- | --- | --- |
| 409 | `effect_not_available` | Effect futuro / no en def |
| 409 | `subject_mismatch` | Reto de otra materia |
| 409 | `not_usable` | Materia inactiva |
| 409 | `no_active_challenge` | No hay reto al que aplicar |
| 409 | `retry_not_eligible` | No hay fallo previo elegible |
| 422 | payload inválido | |

---

## 4. Reglas pedagógicas

| Regla | Detalle |
| --- | --- |
| Hint | No incluir `canonical_answer` ni letra de opción correcta |
| Hint | Máx. 1 hint por reto (segundo uso → 409 o hint más débil — elegir **máx 1** en MVP) |
| Retry | Máx. 1 retry por reto; el score del camino puede marcar «con ayuda» para el tutor |
| No skip placement | Effects no aplican en examen de acceso |
| Tutor settings | Futuro: `learning.allow_item_helps` default true |

---

## 5. Ledger

Evento `item_used` en `events.jsonl`:

```json
{
  "kind": "item_used",
  "item_def_id": "fantasy_potion_focus_math",
  "effect_id": "challenge_hint",
  "challenge_ref": "...",
  "ts": "..."
}
```

---

## 6. Criterios de aceptación (cuando se implemente P2)

1. Hint no contiene respuesta canónica (test con fixture). ✅
2. Retry reabre reto y consume qty. ✅ (servicio + reopen en diálogo)
3. Uso en materia incorrecta → 409. ✅
4. Placement → 409 `no_active_challenge` o `effect_not_available`. ✅
5. UI play refleja qty tras uso sin reload completo. ✅

## Aprobación

- [x] Enum y fases X4–X5
- [x] API §3
- [x] Límites pedagógicos §4 (máx. 1 hint/retry por índice vía `helps` en path_progress)
- [x] UI «Próximamente» para effects no implementados; Usar activo para hint/retry
