# Spec: HUD de progreso de nivel en play (bajo el capítulo)

> Estado: **aprobada — implementada parcialmente** (ago 2026)  
> Relacionado: [SPEC_APP_CREW_PROGRESS.md](SPEC_APP_CREW_PROGRESS.md), [SPEC_APP_PROGRESSION_RANKS.md](SPEC_APP_PROGRESSION_RANKS.md), [SPEC_APP_JOURNEY_CHAPTERS.md](SPEC_APP_JOURNEY_CHAPTERS.md), [SPEC_APP_SECTION_FRAME.md](SPEC_APP_SECTION_FRAME.md), [SPEC_APP_PLAY_BAGGAGE_TOGGLE.md](SPEC_APP_PLAY_BAGGAGE_TOGGLE.md), [SPEC_APP_SETTINGS_SECTION.md](SPEC_APP_SETTINGS_SECTION.md), [SPEC_APP_VISUAL_DESIGN_V3.md](SPEC_APP_VISUAL_DESIGN_V3.md) (`SessionHud`)

## Contexto

Al entrar en la aventura, el viajero debe ver su **nivel general actual** y el **progreso hacia el siguiente**, de forma análoga a la barra de la ficha de tripulante. Se coloca **bajo el título de capítulo** en la cabecera fija del cajetín. El desglose por materias queda fuera de este corte (detalle futuro / equipaje no lo sustituye).

## Objetivo

1. Barra de progreso general fija bajo `.section-frame__title` (capítulo).
2. Copy respetando `show_levels_to_child`.
3. Ocultar durante fases sin nivel (pre-placement / placement).
4. Reutilizar fórmulas/DTO de [SPEC_APP_CREW_PROGRESS](SPEC_APP_CREW_PROGRESS.md).

---

## 1. Decisiones

| # | Decisión | Valor |
| --- | --- | --- |
| H1 | Alcance MVP | **Solo** progreso **general** (no materias en HUD) |
| H2 | Ubicación | Cabecera del marco, **debajo** del título de capítulo, **fijo** (no scroll) |
| H3 | Visible en | Modos `dialogue` y `baggage` |
| H4 | Datos | `CrewProgressService` → mapper play; o campo en `open_session` / `GET …/progress` |
| H5 | Niveles L* al niño | Solo si `learning.show_levels_to_child === true`; si no → rango + % sin «Nivel N» |
| H6 | Placement / umbral | HUD **oculto** (`hidden`) hasta `placement_status === completed` |
| H7 | Actualización | Tras effects `update_subject_level` / `set_general_level` / cierre camino |

---

## 2. Layout

```
┌─────────────────────────────────────────┐
│ [←]     [logo]  La senda continúa  [🎒] │
│         Adepto · ████████░░ 62%         │  ← play-progress-hud
├─────────────────────────────────────────┤
│  (scroll diálogo o equipaje)            │
```

Estructura DOM propuesta:

```html
<header class="section-frame__header">
  … nav back …
  <div class="section-frame__brand">…logo… <h1 class="section-frame__title …">…</h1></div>
  … toggle baggage …
  <div class="play-progress-hud" data-play-progress-hud hidden>
    <div class="play-progress-hud__meta">…</div>
    <div class="play-progress-hud__bar" role="progressbar" …>
      <div class="play-progress-hud__fill" style="width:…"></div>
    </div>
  </div>
</header>
```

El brand (logo+título) puede quedar en una fila; el HUD en **fila completa** bajo el brand para no pelear el ellipsis del capítulo.

Altura extra cabecera: ≤ 36–44 px adicionales en 390×844.

---

## 3. Copy

### 3.1 Con `show_levels_to_child = false` (default)

| Elemento | Ejemplo |
| --- | --- |
| Meta | `{rank.label_child}` o «Explorador» si sin rango |
| Barra | `aria-valuenow={percent}` |
| Texto % | `62 %` a la derecha de meta **o** solo barra + sr-only |

**Prohibido** en UI visible: `L3`, «Nivel 3».

### 3.2 Con `show_levels_to_child = true`

| Elemento | Ejemplo |
| --- | --- |
| Meta | `Nivel 3 → 4` (+ rango opcional en segunda línea micro si cabe) |
| % | igual |

Usar `formatLevelLabel` del cliente (`Nivel N`).

### 3.3 Tope L5

Meta: «Nivel máximo» / rango tope; barra 100%; `aria-valuetext="Completado"`.

---

## 4. DTO play

```ts
interface PlayProgressHudDto {
  visible: boolean;
  show_levels_to_child: boolean;
  rank_label_child: string | null;
  general_progress: {
    current: string;       // L3
    next: string | null;
    percent_to_next: number;
  } | null;
}
```

Fuentes: mismos campos que `CrewProgressDto.general_progress` + `rank.label_child` + settings learning.

Endpoint opciones:

| Opción | Ruta |
| --- | --- |
| A | Embebido en `POST …/dialogue/session` → `progress_hud` |
| B | `GET /api/v1/play/{id}/progress` |

Preferencia: **A + invalidate** en turn responses cuando cambie nivel (`progress_hud` opcional en submit_turn).

---

## 5. Estilo

Reutilizar tokens de `.crew-progress__bar` / fill; variante compacta:

| Token | Valor |
| --- | --- |
| Altura barra | 6–8 px |
| Fill | acento según `data-play-theme` |
| Tipografía meta | Nunito / display mundo a escala `0.72–0.8rem` |

Clases: `web/css/scenes/play.css` bloque `.play-progress-hud`.

---

## 6. Criterios de aceptación

1. Tras placement completed, HUD visible bajo capítulo con % coherente con ficha.
2. Durante `rito` / umbral sin nivel: HUD `hidden`.
3. Flag `show_levels_to_child=false` → sin texto «Nivel N».
4. Flag true → «Nivel N → N+1».
5. Visible también en vista equipaje.
6. Tras subir nivel en turno, barra actualiza sin salir de play.
7. Playwright: `tmp/playwright-output/play-progress-hud-v1.png`.

## 7. Fases

| Fase | Entregable |
| --- | --- |
| **H1** | HUD general + API/session field |
| **H2** | Animación fill al subir % |
| **H3** | (Futuro) desglose materias en sheet aparte — **no** en esta spec |

## Aprobación

- [ ] Solo progreso general bajo capítulo
- [ ] Reglas copy §3 + flag tutor
- [ ] Oculto pre-placement
