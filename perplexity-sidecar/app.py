import json
import logging
import os
import random
import time
import urllib.request
import urllib.error
from uuid import uuid4

from curl_cffi import requests as cffi_requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("perplexity-sidecar")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PERPLEXITY_BASE = "https://www.perplexity.ai"
ENDPOINT_AUTH_SESSION = f"{PERPLEXITY_BASE}/api/auth/session"
ENDPOINT_SSE_ASK = f"{PERPLEXITY_BASE}/rest/sse/perplexity_ask"

DEFAULT_HEADERS = {
    "accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,image/apng,*/*;q=0.8,"
        "application/signed-exchange;v=b3;q=0.7"
    ),
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "max-age=0",
    "dnt": "1",
    "priority": "u=0, i",
    "sec-ch-ua": '"Not;A=Brand";v="24", "Chromium";v="128"',
    "sec-ch-ua-arch": '"x86"',
    "sec-ch-ua-bitness": '"64"',
    "sec-ch-ua-full-version": '"128.0.6613.120"',
    "sec-ch-ua-full-version-list": (
        '"Not;A=Brand";v="24.0.0.0", "Chromium";v="128.0.6613.120"'
    ),
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-model": '""',
    "sec-ch-ua-platform": '"Windows"',
    "sec-ch-ua-platform-version": '"19.0.0"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "same-origin",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1",
    "user-agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/128.0.0.0 Safari/537.36"
    ),
}

# Model name (as exposed via /v1/models) -> (perplexity mode, model_preference)
MODEL_MAP: dict[str, tuple[str, str]] = {
    # Auto mode
    "perplexity-auto": ("auto", "turbo"),
    # Pro mode
    "perplexity-pro": ("pro", "pplx_pro"),
    "perplexity-sonar": ("pro", "experimental"),
    "perplexity-gpt-5.2": ("pro", "gpt52"),
    "perplexity-claude-4.5-sonnet": ("pro", "claude45sonnet"),
    "perplexity-grok-4.1": ("pro", "grok41nonreasoning"),
    # Reasoning mode
    "perplexity-reasoning": ("reasoning", "pplx_reasoning"),
    "perplexity-gpt-5.2-thinking": ("reasoning", "gpt52_thinking"),
    "perplexity-claude-4.5-sonnet-thinking": ("reasoning", "claude45sonnetthinking"),
    "perplexity-gemini-3.0-pro": ("reasoning", "gemini30pro"),
    "perplexity-kimi-k2-thinking": ("reasoning", "kimik2thinking"),
    "perplexity-grok-4.1-reasoning": ("reasoning", "grok41reasoning"),
    # Deep research
    "perplexity-deep-research": ("deep research", "pplx_alpha"),
}

# ---------------------------------------------------------------------------
# Session management
# ---------------------------------------------------------------------------


class PerplexitySession:
    """Manages a curl_cffi session with Chrome TLS fingerprinting."""

    def __init__(self, cookies: dict[str, str]) -> None:
        self.cookies = cookies
        self.session = cffi_requests.Session(
            headers=DEFAULT_HEADERS.copy(),
            cookies=cookies,
            impersonate="chrome",
        )
        self.timestamp = format(random.getrandbits(32), "08x")
        # Initialise session (sets CSRF token etc.)
        try:
            self.session.get(ENDPOINT_AUTH_SESSION, timeout=15)
            log.info("Perplexity session initialised")
        except Exception as exc:
            log.warning("Session init failed (may still work): %s", exc)

    def ask(
        self,
        query: str,
        mode: str,
        model_preference: str,
        language: str = "en-US",
    ):
        """Send a query and return an iterator of SSE chunks."""
        payload = {
            "query_str": query,
            "params": {
                "attachments": [],
                "frontend_context_uuid": str(uuid4()),
                "frontend_uuid": str(uuid4()),
                "is_incognito": False,
                "language": language,
                "last_backend_uuid": None,
                "mode": "concise" if mode == "auto" else "copilot",
                "model_preference": model_preference,
                "source": "default",
                "sources": ["web"],
                "version": "2.18",
            },
        }

        resp = self.session.post(
            ENDPOINT_SSE_ASK,
            json=payload,
            stream=True,
            timeout=300,
        )

        if resp.status_code != 200:
            raise HTTPException(
                status_code=resp.status_code,
                detail=f"Perplexity returned {resp.status_code}",
            )

        return resp


def parse_sse_chunks(resp):
    """Parse Perplexity SSE response, yielding parsed JSON dicts."""
    for chunk in resp.iter_lines(delimiter=b"\r\n\r\n"):
        content = chunk.decode("utf-8", errors="replace")

        if content.startswith("event: message\r\n"):
            try:
                data_str = content[len("event: message\r\ndata: ") :]
                content_json = json.loads(data_str)

                # Parse nested 'text' field for deep-research / reasoning
                if "text" in content_json and content_json["text"]:
                    try:
                        text_parsed = json.loads(content_json["text"])
                        if isinstance(text_parsed, list):
                            for step in text_parsed:
                                if step.get("step_type") == "FINAL":
                                    final_content = step.get("content", {})
                                    if "answer" in final_content:
                                        answer_data = json.loads(
                                            final_content["answer"]
                                        )
                                        content_json["answer"] = answer_data.get(
                                            "answer", ""
                                        )
                                        break
                        content_json["text"] = text_parsed
                    except (json.JSONDecodeError, TypeError, KeyError):
                        pass

                yield content_json
            except (json.JSONDecodeError, KeyError):
                continue

        elif content.startswith("event: end_of_stream\r\n"):
            return


def extract_answer(chunk: dict) -> str:
    """Extract the best available answer text from a Perplexity chunk."""
    if "answer" in chunk and chunk["answer"]:
        return chunk["answer"]
    if isinstance(chunk.get("text"), str):
        return chunk["text"]
    if isinstance(chunk.get("text"), dict) and "answer" in chunk["text"]:
        return chunk["text"]["answer"]
    return ""


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="Perplexity Pro Sidecar", version="1.0.0")

DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "http://dashboard:3000")
SIDECAR_SECRET = os.environ.get("PERPLEXITY_SIDECAR_SECRET") or os.environ.get(
    "MANAGEMENT_API_KEY", ""
)

_session: PerplexitySession | None = None
_session_cookie_hash: str = ""


def _fetch_cookies_from_dashboard() -> dict[str, str] | None:
    url = f"{DASHBOARD_URL}/api/providers/perplexity-cookie/current"
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {SIDECAR_SECRET}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("cookies"):
                return data["cookies"]
    except (urllib.error.URLError, json.JSONDecodeError, OSError) as exc:
        log.debug("Dashboard cookie fetch failed: %s", exc)
    return None


def get_session() -> PerplexitySession:
    global _session, _session_cookie_hash

    dashboard_cookies = _fetch_cookies_from_dashboard()

    if dashboard_cookies:
        cookie_hash = json.dumps(dashboard_cookies, sort_keys=True)
        if _session is None or cookie_hash != _session_cookie_hash:
            log.info("Initialising session from dashboard cookies")
            _session = PerplexitySession(dashboard_cookies)
            _session_cookie_hash = cookie_hash
        return _session

    if _session is not None:
        return _session

    raw = os.environ.get("PERPLEXITY_COOKIES", "")
    if not raw:
        raise HTTPException(
            status_code=500,
            detail="No cookies configured. Set them via the dashboard or PERPLEXITY_COOKIES env var.",
        )

    try:
        cookies = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"PERPLEXITY_COOKIES is not valid JSON: {exc}",
        )

    _session = PerplexitySession(cookies)
    _session_cookie_hash = json.dumps(cookies, sort_keys=True)
    return _session


# ---------------------------------------------------------------------------
# GET /v1/models
# ---------------------------------------------------------------------------


@app.get("/v1/models")
async def list_models():
    """Return available models in OpenAI format."""
    models = []
    for model_id in MODEL_MAP:
        models.append(
            {
                "id": model_id,
                "object": "model",
                "created": 1700000000,
                "owned_by": "perplexity-pro",
                "permission": [],
                "root": model_id,
                "parent": None,
            }
        )
    return {"object": "list", "data": models}


# ---------------------------------------------------------------------------
# POST /v1/chat/completions
# ---------------------------------------------------------------------------


@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    """OpenAI-compatible chat completions endpoint."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    model = body.get("model", "perplexity-pro")
    stream = body.get("stream", False)
    messages = body.get("messages", [])

    if not messages:
        raise HTTPException(status_code=400, detail="messages is required")

    if model not in MODEL_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown model: {model}. Available: {list(MODEL_MAP.keys())}",
        )

    mode, model_preference = MODEL_MAP[model]

    # Flatten messages into a single query string.
    # System messages become context prefix, user/assistant alternate.
    parts: list[str] = []
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if isinstance(content, list):
            # Handle structured content (text blocks)
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

    query = "\n\n".join(parts)

    session = get_session()

    request_id = f"chatcmpl-{uuid4().hex[:24]}"
    created = int(time.time())

    if stream:
        return StreamingResponse(
            _stream_response(
                session, query, mode, model_preference, model, request_id, created
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # Non-streaming: collect full response
    try:
        resp = session.ask(query, mode, model_preference)
        last_chunk = {}
        for chunk in parse_sse_chunks(resp):
            last_chunk = chunk

        answer = extract_answer(last_chunk)

        return JSONResponse(
            {
                "id": request_id,
                "object": "chat.completion",
                "created": created,
                "model": model,
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": answer,
                        },
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
    except HTTPException:
        raise
    except Exception as exc:
        log.exception("Perplexity request failed")
        raise HTTPException(status_code=502, detail=str(exc))


async def _stream_response(
    session: PerplexitySession,
    query: str,
    mode: str,
    model_preference: str,
    model: str,
    request_id: str,
    created: int,
):
    """Yield SSE chunks in OpenAI streaming format."""
    try:
        resp = session.ask(query, mode, model_preference)

        previous_answer = ""

        for chunk in parse_sse_chunks(resp):
            current_answer = extract_answer(chunk)

            # Only emit when there's new content (delta)
            if current_answer and current_answer != previous_answer:
                # Compute the delta (new text since last emit)
                if current_answer.startswith(previous_answer):
                    delta = current_answer[len(previous_answer) :]
                else:
                    delta = current_answer

                previous_answer = current_answer

                sse_data = {
                    "id": request_id,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": model,
                    "choices": [
                        {
                            "index": 0,
                            "delta": {"content": delta},
                            "finish_reason": None,
                        }
                    ],
                }
                yield f"data: {json.dumps(sse_data)}\n\n"

        # Final chunk with finish_reason
        final_data = {
            "id": request_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "delta": {},
                    "finish_reason": "stop",
                }
            ],
        }
        yield f"data: {json.dumps(final_data)}\n\n"
        yield "data: [DONE]\n\n"

    except HTTPException:
        raise
    except Exception as exc:
        log.exception("Stream failed")
        error_data = {
            "error": {
                "message": str(exc),
                "type": "server_error",
                "code": "perplexity_error",
            }
        }
        yield f"data: {json.dumps(error_data)}\n\n"
        yield "data: [DONE]\n\n"


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


@app.get("/health")
async def health():
    env_cookies = bool(os.environ.get("PERPLEXITY_COOKIES"))
    dashboard_cookies = _fetch_cookies_from_dashboard() is not None
    return {
        "status": "ok",
        "cookies_configured": env_cookies or dashboard_cookies,
        "source": "dashboard"
        if dashboard_cookies
        else ("env" if env_cookies else "none"),
    }


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8766"))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
