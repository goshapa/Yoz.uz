import asyncio

from fastapi import HTTPException, UploadFile, status

from app.services.storage import upload_object

MAX_VIDEO_BYTES = 50 * 1024 * 1024
VIDEO_EXTENSION_BY_CONTENT_TYPE = {"video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov"}


async def process_video_upload(file: UploadFile) -> str:
    """Заливает видео как есть (без перекодирования) и возвращает публичный URL."""
    content_type = file.content_type or ""
    if content_type not in VIDEO_EXTENSION_BY_CONTENT_TYPE:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Поддерживаются видео форматов MP4, WebM, MOV"
        )

    raw = await file.read()
    if not raw:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Пустой файл")
    if len(raw) > MAX_VIDEO_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Видео больше 50 МБ")

    extension = VIDEO_EXTENSION_BY_CONTENT_TYPE[content_type]
    return await asyncio.to_thread(upload_object, raw, content_type, extension)
