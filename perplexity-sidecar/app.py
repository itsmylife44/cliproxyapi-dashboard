import asyncio
import json
import logging
import os
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

from perplexity_webui_scraper import (
    CitationMode,
    ConversationConfig,
    Models,
    Perplexity,
    PerplexityError,
)
from perplexity_webui_scraper.models import Model

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("perplexity-sidecar")

DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "http://dashboard:3000")
SIDECAR_SECRET = os.environ.get("PERPLEXITY_SIDECAR_SECRET") or os.environ.get(
    "MANAGEMENT_API_KEY", ""
)
SESSION_COOKIE_NAME = "__Secure-next-auth.session-token"


# ---------------------------------------------------------------------------
# Auto Model Discovery — builds model map from library at startup
# ---------------------------------------------------------------------------

PROVIDER_MAP = {
    "gpt": "openai",
    "claude": "anthropic",
    "gemini": "google",
    "grok": "xai",
    "kimi": "moonshot",
    "pplx": "perplexity",
    "sonar": "perplexity",
    "experimental": "perplexity",
}


def _attr_name_to_alias(attr_name: str) -> str:
    """BEST -> perplexity-auto, GPT_52_THINKING -> perplexity-gpt-5.2-thinking"""
    special = {
        "BEST": "perplexity-auto",
        "SONAR": "perplexity-sonar",
        "DEEP_RESEARCH": "perplexity-deep-research",
        "CREATE_FILES_AND_APPS": "perplexity-labs",
    }
    if attr_name in special:
        return special[attr_name]

    parts = attr_name.lower().split("_")
    result_parts = []
    i = 0
    while i < len(parts):
        part = parts[i]
        # GPT_52 -> gpt-5.2, CLAUDE_45 -> claude-4.5, GEMINI_3 -> gemini-3
        if i + 1 < len(parts) and re.match(r"^\d+$", parts[i + 1]):
            digits = parts[i + 1]
            if len(digits) >= 2:
                result_parts.append(f"{part}-{digits[0]}.{digits[1:]}")
            else:
                result_parts.append(f"{part}-{digits}")
            i += 2
            continue
        result_parts.append(part)
        i += 1

    return "perplexity-" + "-".join(result_parts)


def _infer_provider(identifier: str) -> str:
    for prefix, provider in PROVIDER_MAP.items():
        if identifier.lower().startswith(prefix):
            return provider
    return "perplexity"


def discover_models() -> dict[str, dict]:
    """Scan Models class and build {alias: {model, identifier, provider}} map."""
    registry: dict[str, dict] = {}

    for attr_name in dir(Models):
        if attr_name.startswith("_"):
            continue
        model_obj = getattr(Models, attr_name)
        if not isinstance(model_obj, Model):
            continue

        alias = _attr_name_to_alias(attr_name)
        provider = _infer_provider(model_obj.identifier)
        registry[alias] = {
            "model": model_obj,
            "identifier": model_obj.identifier,
            "provider": provider,
            "attr": attr_name,
        }

    # Extra alias: perplexity-pro -> same as perplexity-auto
    if "perplexity-auto" in registry:
        registry["perplexity-pro"] = registry["perplexity-auto"]

    # Extra alias: perplexity-reasoning -> perplexity-auto (uses BEST in reasoning context)
    if "perplexity-auto" in registry:
        registry["perplexity-reasoning"] = registry["perplexity-auto"]

    return registry


MODEL_REGISTRY = discover_models()
log.info("Discovered %d models: %s", len(MODEL_REGISTRY), list(MODEL_REGISTRY.keys()))


# ---------------------------------------------------------------------------
# Auto-update: check PyPI periodically, restart if newer version available
# ---------------------------------------------------------------------------

UPDATE_CHECK_INTERVAL = int(os.environ.get("UPDATE_CHECK_INTERVAL", "3600"))


def _get_installed_version() -> str:
    try:
        from importlib.metadata import version

        return version("perplexity-webui-scraper")
    except Exception:
        return "0.0.0"


def _get_pypi_version() -> str | None:
    try:
        req = urllib.request.Request(
            "https://pypi.org/pypi/perplexity-webui-scraper/json",
            headers={"Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("info", {}).get("version")
    except Exception as exc:
        log.debug("PyPI version check failed: %s", exc)
    return None


def _trigger_dashboard_sync():
    url = f"{DASHBOARD_URL}/api/providers/perplexity-cookie/sync-models"
    data = json.dumps({}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {SIDECAR_SECRET}",
            "Content-Type": "application/json",
        },
        method="PUT",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            log.info("Dashboard sync result: %s", body)
    except Exception as exc:
        log.warning("Dashboard sync failed (will sync on next restart): %s", exc)


def _auto_update_loop():
    while True:
        time.sleep(UPDATE_CHECK_INTERVAL)
        try:
            installed = _get_installed_version()
            latest = _get_pypi_version()
            if not latest or latest == installed:
                log.debug("Library up to date (%s)", installed)
                continue

            log.info(
                "New perplexity-webui-scraper version available: %s -> %s. Upgrading and restarting...",
                installed,
                latest,
            )
            result = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "pip",
                    "install",
                    "--no-cache-dir",
                    "--quiet",
                    "--upgrade",
                    "perplexity-webui-scraper",
                ],
                capture_output=True,
                text=True,
                timeout=120,
            )
            if result.returncode == 0:
                log.info("Upgrade successful. Triggering model sync before restart...")
                _trigger_dashboard_sync()
                log.info("Exiting for restart...")
                os._exit(0)
            else:
                log.error("Upgrade failed: %s", result.stderr)
        except Exception as exc:
            log.error("Auto-update check failed: %s", exc)


threading.Thread(target=_auto_update_loop, daemon=True).start()
log.info("Auto-update checker started (interval: %ds)", UPDATE_CHECK_INTERVAL)


def _startup_sync():
    time.sleep(10)
    log.info("Running startup model sync...")
    _trigger_dashboard_sync()


threading.Thread(target=_startup_sync, daemon=True).start()


# ---------------------------------------------------------------------------
# Cookie / session management
# ---------------------------------------------------------------------------

_client: Perplexity | None = None
_client_token_hash: str = ""


def _fetch_session_token_from_dashboard() -> str | None:
    url = f"{DASHBOARD_URL}/api/providers/perplexity-cookie/current"
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {SIDECAR_SECRET}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            cookies = data.get("cookies")
            if not cookies:
                return None
            token = cookies.get(SESSION_COOKIE_NAME) or cookies.get(
                "next-auth.session-token"
            )
            return token or None
    except (urllib.error.URLError, json.JSONDecodeError, OSError) as exc:
        log.debug("Dashboard cookie fetch failed: %s", exc)
    return None


def _get_session_token() -> str:
    token = _fetch_session_token_from_dashboard()
    if token:
        return token

    token = os.environ.get("PERPLEXITY_SESSION_TOKEN", "").strip()
    if token:
        return token

    raw = os.environ.get("PERPLEXITY_COOKIES", "").strip()
    if raw:
        try:
            cookies = json.loads(raw)
            t = cookies.get(SESSION_COOKIE_NAME) or cookies.get(
                "next-auth.session-token"
            )
            if t:
                return t
        except json.JSONDecodeError:
            pass

    raise HTTPException(
        status_code=500,
        detail="No Perplexity session token configured. Set cookies via the dashboard or PERPLEXITY_SESSION_TOKEN env var.",
    )


def get_client() -> Perplexity:
    global _client, _client_token_hash

    token = _get_session_token()
    token_hash = token[:16] + token[-16:]

    if _client is None or token_hash != _client_token_hash:
        if _client is not None:
            try:
                _client.close()
            except Exception:
                pass
        log.info("Initialising Perplexity client (token changed or first init)")
        _client = Perplexity(session_token=token)
        _client_token_hash = token_hash

    return _client


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def messages_to_query(messages: list[dict]) -> str:
    parts: list[str] = []
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if isinstance(content, list):
            text_parts = []
            for block in content:
                if isinstance(block, dict) and block.get("type") == "text":
                    text_parts.append(block.get("text", ""))
                elif isinstance(block, str):
                    text_parts.append(block)
            content = "\n".join(text_parts)
        if role == "system":
            parts.append(f"[System Instructions]\n{content}\n")
        elif role == "assistant":
            parts.append(f"[Previous Assistant Response]\n{content}\n")
        else:
            parts.append(content)
    return "\n\n".join(parts)


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="Perplexity Pro Sidecar", version="2.2.0")


@app.get("/v1/models")
async def list_models():
    now = int(time.time())
    seen = set()
    models = []
    for alias, info in MODEL_REGISTRY.items():
        if alias in seen:
            continue
        seen.add(alias)
        models.append(
            {
                "id": alias,
                "object": "model",
                "created": now,
                "owned_by": f"perplexity-pro",
            }
        )
    return {"object": "list", "data": models}


@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    model_name = body.get("model", "perplexity-auto")
    stream = body.get("stream", False)
    messages = body.get("messages", [])

    if not messages:
        raise HTTPException(status_code=400, detail="messages is required")

    entry = MODEL_REGISTRY.get(model_name)
    if entry is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown model: {model_name}. Available: {list(MODEL_REGISTRY.keys())}",
        )

    model_obj = entry["model"]
    query = messages_to_query(messages)
    request_id = f"chatcmpl-{uuid4().hex[:24]}"
    created = int(time.time())

    client = get_client()
    config = ConversationConfig(citation_mode=CitationMode.CLEAN)
    conversation = client.create_conversation(config)

    if stream:
        return StreamingResponse(
            _stream_response(
                conversation, query, model_obj, model_name, request_id, created
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    try:
        conversation.ask(query, model=model_obj, stream=False)
        answer = conversation.answer or ""

        return JSONResponse(
            {
                "id": request_id,
                "object": "chat.completion",
                "created": created,
                "model": model_name,
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": answer},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "total_tokens": 0,
                },
            }
        )
    except PerplexityError as exc:
        log.error("Perplexity error: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        log.exception("Request failed")
        raise HTTPException(status_code=502, detail=str(exc))


async def _stream_response(
    conversation,
    query: str,
    model_obj: Model,
    model_name: str,
    request_id: str,
    created: int,
):
    queue: asyncio.Queue[tuple[str, str]] = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def producer():
        last = ""
        try:
            for resp in conversation.ask(query, model=model_obj, stream=True):
                current = resp.answer or ""
                if len(current) > len(last):
                    delta = current[len(last) :]
                    last = current
                    loop.call_soon_threadsafe(queue.put_nowait, ("delta", delta))
            loop.call_soon_threadsafe(queue.put_nowait, ("done", ""))
        except Exception as e:
            try:
                conversation.ask(query, model=model_obj, stream=False)
                current = conversation.answer or ""
                if len(current) > len(last):
                    loop.call_soon_threadsafe(
                        queue.put_nowait, ("delta", current[len(last) :])
                    )
                loop.call_soon_threadsafe(queue.put_nowait, ("done", ""))
            except Exception as e2:
                loop.call_soon_threadsafe(
                    queue.put_nowait, ("error", str(e2) or str(e))
                )

    threading.Thread(target=producer, daemon=True).start()

    init_data = {
        "id": request_id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": model_name,
        "choices": [
            {
                "index": 0,
                "delta": {"role": "assistant", "content": ""},
                "finish_reason": None,
            }
        ],
    }
    yield f"data: {json.dumps(init_data)}\n\n"

    while True:
        kind, payload = await queue.get()
        if kind == "delta":
            chunk_data = {
                "id": request_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model_name,
                "choices": [
                    {"index": 0, "delta": {"content": payload}, "finish_reason": None}
                ],
            }
            yield f"data: {json.dumps(chunk_data)}\n\n"
        elif kind == "error":
            log.error("Stream error: %s", payload)
            err_data = {
                "id": request_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model_name,
                "choices": [{"index": 0, "delta": {}, "finish_reason": "error"}],
            }
            yield f"data: {json.dumps(err_data)}\n\n"
            break
        else:
            break

    final_data = {
        "id": request_id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": model_name,
        "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
    }
    yield f"data: {json.dumps(final_data)}\n\n"
    yield "data: [DONE]\n\n"


@app.get("/health")
async def health():
    dashboard_token = _fetch_session_token_from_dashboard()
    env_token = bool(
        os.environ.get("PERPLEXITY_SESSION_TOKEN")
        or os.environ.get("PERPLEXITY_COOKIES")
    )
    has_token = dashboard_token is not None or env_token

    return {
        "status": "ok" if has_token else "degraded",
        "version": "2.2.0",
        "engine": "perplexity-webui-scraper",
        "library_version": _get_installed_version(),
        "token_configured": has_token,
        "source": "dashboard" if dashboard_token else ("env" if env_token else "none"),
        "models_count": len(MODEL_REGISTRY),
    }


@app.get("/")
async def root():
    return {
        "service": "perplexity-sidecar",
        "version": "2.2.0",
        "engine": "perplexity-webui-scraper",
        "library_version": _get_installed_version(),
        "endpoints": ["GET /v1/models", "POST /v1/chat/completions", "GET /health"],
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8766"))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
