# Reglas de Agente (kidepik)

Las **reglas generales** del workspace (Playwright, Engram, Context7, eficiencia LLM, GitHub MCP, etc.) están en el repositorio hub `Vibe-Coding` bajo `.cursor/rules/` cuando forma parte del mismo workspace en Cursor; **no** se duplican aquí.

Índice de reglas **solo de este repo** (`.cursor/rules/`):

| Regla | Descripción | Aplicación |
| :--- | :--- | :--- |
| [repo-bootstrap.mdc](../.cursor/rules/repo-bootstrap.mdc) | Reglas base del repositorio `kidepik` | `alwaysApply: true` |
| [agent-skill-routing.mdc](../.cursor/rules/agent-skill-routing.mdc) | Enrutamiento a skills locales | `alwaysApply: true` |
| [cursor-browser-mcp-testing.mdc](../.cursor/rules/cursor-browser-mcp-testing.mdc) | Pruebas UI vía MCP browser — **`localhost:8082`** | `alwaysApply: true` |
| [web-mobile-preview.mdc](../.cursor/rules/web-mobile-preview.mdc) | Preview web móvil (Electron, Playwright 390×844) | `globs: web/**` |

Consulta [AGENTS.md](./AGENTS.md) para el contexto general del proyecto.
