# PERPLEXITY SIDECAR KNOWLEDGE BASE

**Scope:** `perplexity-sidecar/`

## OVERVIEW
Python FastAPI sidecar exposing OpenAI-compatible chat/models endpoints backed by Perplexity session-cookie auth and dynamic model discovery.

## STRUCTURE
```text
perplexity-sidecar/
├── app.py           # FastAPI app + model discovery + streaming + auto-update
├── requirements.txt # fastapi, uvicorn, perplexity-webui-scraper
├── Dockerfile       # python:3.12-slim non-root runtime
└── entrypoint.sh
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Model registry/aliases | `app.py` (`discover_models`) | maps library slugs to API model IDs |
| Sidecar↔dashboard sync | `app.py` (`_trigger_dashboard_sync`) | calls dashboard sync endpoint with bearer secret |
| Token sourcing | `app.py` (`_get_session_token`) | dashboard cookie API first, env fallbacks next |
| OpenAI compatibility | `app.py` (`/v1/models`, `/v1/chat/completions`) | expected by upstream proxy clients |
| Auto-update behavior | `app.py` (`_auto_update_loop`) | optional PyPI check + self-restart |

## CONVENTIONS
- Keep API surface OpenAI-compatible for model list + chat completions.
- Maintain strict separation between sidecar secret and public API keys.
- Prefer dashboard-managed cookie source over local env when available.

## ANTI-PATTERNS
- Do not expose raw session tokens in logs.
- Do not bypass bearer-secret auth on dashboard sync/cookie endpoints.
- Do not hardcode model IDs when they can be derived from discovered MODELS.
