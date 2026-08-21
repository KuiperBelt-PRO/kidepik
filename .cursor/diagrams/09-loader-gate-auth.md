# 09 — Loader, puerta y auth

**Specs:** [SPEC_LOADER_APP_GATE.md](../specify/SPEC_LOADER_APP_GATE.md), [SPEC_APP_AUTH.md](../specify/SPEC_APP_AUTH.md), [SPEC_LOADER_SCREEN.md](../specify/SPEC_LOADER_SCREEN.md)  
**Código:** `loader-gate.js`, `loader-auth-morph.js`, `auth-panel.js`, `scenes/loader.js`

```mermaid
stateDiagram-v2
  [*] --> loading
  loading --> ready: anillo 100% + hint 0.5s
  ready --> exiting: tap disco central
  exiting --> home: sesión tutor
  exiting --> member: sesión crew
  exiting --> authMorph: sin sesión
  authMorph --> authIdle: morph in-place
  authIdle --> home: Google OK + bootstrap tutor
  authIdle --> member: Google OK + bootstrap crew
  authIdle --> legal: enlaces términos/privacidad
```

## Flujo feliz

```mermaid
sequenceDiagram
  participant U as Usuario
  participant L as Loader + Gate
  participant SB as Supabase
  participant API as FastAPI session/parents

  U->>L: espera reveal + progreso
  L-->>U: hint Pulsa para comenzar…
  U->>L: tap focal
  alt hay sesión
    L->>SB: getSession
    L->>API: bootstrap / me
    alt role tutor
      L-->>U: #/home + shell
    else role crew
      L-->>U: #/member + shell
    end
  else sin sesión
    L->>L: auth-morph in-place
    U->>L: Continuar con Google
    L->>SB: OAuth PKCE
    SB-->>L: #/auth/callback → sesión
    L->>API: bootstrap
    alt role tutor
      L-->>U: #/home
    else role crew
      L-->>U: #/member
    end
  end
```

**Implementado:** [SPEC_APP_CREW_MEMBER_ACCOUNT.md](../specify/SPEC_APP_CREW_MEMBER_ACCOUNT.md) — el bootstrap elige tutor vs tripulante por Gmail invitado.

## Hechos de producto

- Hint: «Pulsa para comenzar» (sci-fi) + «tu viaje épico» (fantasía).
- `#/auth` ≡ loader (panel embebido).
- Tras reload: siempre vuelve a pasar por `loading` → `ready` (tap confirma entrada).

## Anti-errores

- No crear escena auth separada con fondo distinto.
- No bloquear el tap por latencia de red; resolver sesión en paralelo tras el gesto.
