import asyncio
import mimetypes

from fastapi import HTTPException, UploadFile, status

from app.services.storage import upload_object

MAX_VIDEO_BYTES = 50 * 1024 * 1024

# Явные соответствия для типов, где mimetypes.guess_extension() даёт неудобное
# или пустое расширение (например, video/quicktime -> .qt вместо привычного .mov).
_KNOWN_VIDEO_EXTENSIONS = {
    "video/quicktime": "mov",
    "video/x-matroska": "mkv",
    "video/x-msvideo": "avi",
    "video/3gpp": "3gp",
    "video/3gpp2": "3g2",
    "video/x-ms-wmv": "wmv",
    "video/mpeg": "mpeg",
    "video/ogg": "ogv",
}


def _extension_for(content_type: str) -> str:
    if content_type in _KNOWN_VIDEO_EXTENSIONS:
        return _KNOWN_VIDEO_EXTENSIONS[content_type]
    guessed = mimetypes.guess_extension(content_type)
    if guessed:
        return guessed.lstrip(".")
    # Последний фолбэк для незнакомого video/* mimetype — берём подтип
    # (video/x-something -> something), чтобы у файла всё равно было расширение.
    subtype = content_type.split("/", 1)[-1].removeprefix("x-")
    return subtype or "mp4"


async def process_video_upload(file: UploadFile) -> str:
    """Заливает видео как есть (без перекодирования) и возвращает публичный URL.
    Формат контейнера не ограничиваем — браузер сам решит, может ли он это
    воспроизвести (нативно это MP4/WebM/MOV; экзотика вроде MKV/AVI может не
    заиграть прямо в плеере, но файл всё равно сохранится и будет доступен по ссылке)."""
    content_type = file.content_type or ""
    if not content_type.startswith("video/"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Файл не является видео")

    raw = await file.read()
    if not raw:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Пустой файл")
    if len(raw) > MAX_VIDEO_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Видео больше 50 МБ")

    extension = _extension_for(content_type)
    return await asyncio.to_thread(upload_object, raw, content_type, extension)
