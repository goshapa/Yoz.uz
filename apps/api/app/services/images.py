import asyncio
import io
from dataclasses import dataclass

import pillow_heif
from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps

# Регистрирует HEIC/HEIF (формат фото по умолчанию на iPhone) как читаемый Pillow-формат —
# без этого Image.open() падает на таких файлах ещё до проверки ниже.
pillow_heif.register_heif_opener()

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_IMAGES_PER_POST = 4
MAX_DIMENSION = 2048
THUMBNAIL_MAX_DIMENSION = 600

_FORMAT_INFO = {
    "JPEG": {"extension": "jpg", "content_type": "image/jpeg"},
    "PNG": {"extension": "png", "content_type": "image/png"},
    "WEBP": {"extension": "webp", "content_type": "image/webp"},
}
# Всё, что Pillow смог прочитать, но что не входит в тройку выше (GIF, BMP, TIFF,
# HEIC/HEIF и т.д.) — конвертируем в JPEG/PNG вместо отказа, чтобы принимать
# действительно любой формат картинки, а не только явно перечисленные.
_FALLBACK_JPEG = {"extension": "jpg", "content_type": "image/jpeg"}
_FALLBACK_PNG = {"extension": "png", "content_type": "image/png"}


@dataclass
class ProcessedImage:
    original_bytes: bytes
    thumbnail_bytes: bytes
    content_type: str
    extension: str
    width: int
    height: int


def _encode(image: Image.Image, fmt: str, max_dimension: int) -> tuple[bytes, int, int]:
    # exif_transpose нормализует поворот по EXIF Orientation до его удаления при сохранении.
    image = ImageOps.exif_transpose(image)
    if fmt == "JPEG" and image.mode in ("RGBA", "P"):
        image = image.convert("RGB")

    image.thumbnail((max_dimension, max_dimension), Image.LANCZOS)

    buffer = io.BytesIO()
    save_kwargs: dict = {"format": fmt}
    if fmt == "JPEG":
        save_kwargs.update(quality=85, optimize=True)
    elif fmt == "WEBP":
        save_kwargs.update(quality=85)
    elif fmt == "PNG":
        save_kwargs.update(optimize=True)

    # Pillow не переносит EXIF/GPS в save(), если явно не передать exif= — метаданные отбрасываются.
    image.save(buffer, **save_kwargs)
    return buffer.getvalue(), image.width, image.height


def _process_bytes(raw: bytes) -> ProcessedImage:
    try:
        probe = Image.open(io.BytesIO(raw))
        probe.verify()
        # verify() делает объект непригодным для дальнейшей работы — открываем заново.
        image = Image.open(io.BytesIO(raw))
        image.load()
    except Exception as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Файл повреждён или не является изображением"
        ) from exc

    actual_format = image.format
    if actual_format in _FORMAT_INFO:
        info = _FORMAT_INFO[actual_format]
        target_format = actual_format
    else:
        has_alpha = image.mode in ("RGBA", "LA", "PA") or "transparency" in image.info
        info = _FALLBACK_PNG if has_alpha else _FALLBACK_JPEG
        target_format = "PNG" if has_alpha else "JPEG"

    full_bytes, width, height = _encode(image, target_format, MAX_DIMENSION)

    thumb_source = Image.open(io.BytesIO(raw))
    thumb_bytes, _, _ = _encode(thumb_source, target_format, THUMBNAIL_MAX_DIMENSION)

    return ProcessedImage(
        original_bytes=full_bytes,
        thumbnail_bytes=thumb_bytes,
        content_type=info["content_type"],
        extension=info["extension"],
        width=width,
        height=height,
    )


async def process_upload(file: UploadFile) -> ProcessedImage:
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Файл больше 10 МБ")
    if not raw:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Пустой файл")

    # Декодирование/сжатие в Pillow — блокирующая CPU-операция, уводим в отдельный поток,
    # чтобы не останавливать event loop на каждой загруженной картинке.
    return await asyncio.to_thread(_process_bytes, raw)
