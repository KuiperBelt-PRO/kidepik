# Spec: Ficha del tripulante — Ajustes (pestaña tutor)

> Estado: **propuesta — pendiente de aprobación** (2 ago 2026)  
> Relacionado: [SPEC_APP_CREW_SECTION.md](SPEC_APP_CREW_SECTION.md), [SPEC_APP_CREW_MEMBER_DETAIL.md](SPEC_APP_CREW_MEMBER_DETAIL.md), [SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md)

## Objetivo

Documentar el contenido de la pestaña **Ajustes** en `#/crew/:childId`, separado de identidad y progreso ([SPEC_APP_CREW_MEMBER_DETAIL.md](SPEC_APP_CREW_MEMBER_DETAIL.md)).

Principio: todo lo que **configura límites del dispositivo y del aprendizaje** vive aquí; lo que **describe quién es y cómo va el viaje** vive en Viaje.

---

## 1. Bloques (orden)

### 1.1 Permisos y límites

Contrato sin cambio respecto a [SPEC_APP_CREW_SECTION.md](SPEC_APP_CREW_SECTION.md) §5:

| Control | Clave |
| --- | --- |
| Empezar solo | `allow_solo_start` |
| PIN antes de continuar | `require_exit_pin` + PIN 4 dígitos |
| Elegir ramas | `can_choose_story_branch` |
| Bloquear mundo | `lock_world_theme` |
| Duración sesión | `max_session_minutes` (slider) |
| Texto en play | `font_scale_play` md/lg/xl |

- Botón **«Guardar permisos»** — guardado explícito.
- `PATCH /api/v1/crew/:id/permissions`

### 1.2 Materias de aprendizaje

Contrato [SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md) §3:

- Checklist por familia.
- Mínimo 1 materia activa.
- Aviso si >10 materias.
- Botón **«Guardar materias»**.
- `PATCH` perfil con `learning.active_subjects`.

**Nota en UI:** «Los cambios de materias aplican al próximo examen o retake.»

### 1.3 Zona peligrosa

| Acción | Efecto |
| --- | --- |
| Pausar tripulante | `status=paused` — no puede entrar en play |
| Eliminar | Modal glass + soft-delete |

---

## 2. Excluido de Ajustes

| Elemento | Ubicación correcta |
| --- | --- |
| Nombre, edad, mundo | Detalles → Perfil |
| Descripción personaje / tutor | Detalles → Perfil |
| Progreso L*, rango, barras | Progreso |
| Materias activas | Progreso |
| Diario del viaje | Viaje → Diario |
| CTA «Entrar en la aventura» | Viaje → Mapa viaje |

---

## 3. Perfil tutor (`is_tutor_profile`)

La ficha del **tutor como miembro** de la tripulación no muestra pestaña Ajustes de niño:

- Solo **Viaje** simplificado: nombre en tripulación + descripción tutor.
- Sin permisos de play, materias ni zona peligrosa.

---

## 4. Criterios de aceptación

1. Pestaña Ajustes contiene solo §1.1–1.3.
2. Guardado explícito permisos y materias sin regresiones.
3. Perfil tutor no muestra bloques de niño.

## Aprobación

- [ ] Separación Viaje / Ajustes aceptada
