from urllib.parse import urlparse

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.services.storage import ensure_bucket

settings = get_settings()

app = FastAPI(title="Yoz API", version="0.1.0", root_path_in_servers=False)


@app.on_event("startup")
async def on_startup() -> None:
    ensure_bucket()

def _collect_allowed_origins() -> list[str]:
    """В dev-режиме фронтенд может быть открыт с нескольких адресов одновременно:
    localhost (с этого компьютера), LAN IP (с телефона в сети) и временный публичный
    туннель (чтобы показать другу) — собираем все, чтобы смена одного адреса не
    ломала доступ с остальных."""
    frontend = urlparse(settings.frontend_base_url)
    origins = {settings.frontend_base_url}
    if frontend.port:
        origins.add(f"{frontend.scheme}://localhost:{frontend.port}")
        origins.add(f"{frontend.scheme}://127.0.0.1:{frontend.port}")

    for raw in settings.extra_allowed_origins.split(","):
        raw = raw.strip()
        if raw:
            origins.add(raw)

    return list(origins)


_allowed_origins = _collect_allowed_origins()
_allowed_origin_hosts = {urlparse(origin).netloc for origin in _allowed_origins}

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


@app.middleware("http")
async def csrf_origin_guard(request: Request, call_next):
    """Базовая защита от CSRF: для запросов, меняющих состояние, Origin/Referer
    должен совпадать с адресом фронтенда. Сессия хранится в httpOnly cookie,
    поэтому классический CSRF (авто-отправка формы с чужого сайта) отсекается
    на этом этапе; double-submit CSRF-токен можно добавить позже при необходимости."""
    if request.method in UNSAFE_METHODS and request.url.path.startswith("/api/v1"):
        origin = request.headers.get("origin") or request.headers.get("referer")
        if origin:
            origin_host = urlparse(origin).netloc
            # Временные туннели cloudflared (trycloudflare.com) получают новый случайный
            # поддомен при каждом перезапуске — вписать его заранее в EXTRA_ALLOWED_ORIGINS
            # невозможно. Раз сам туннель уже требует знать этот адрес, чтобы им
            # пользоваться, доверяем любому поддомену trycloudflare.com только для dev-показа.
            is_dev_tunnel = origin_host.endswith(".trycloudflare.com")
            if origin_host not in _allowed_origin_hosts and not is_dev_tunnel:
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"detail": "Недопустимый источник запроса"},
                )
    return await call_next(request)


app.include_router(api_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
