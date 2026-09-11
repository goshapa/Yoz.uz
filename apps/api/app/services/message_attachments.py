import asyncio
from dataclasses import dataclass

from fastapi import HTTPException, UploadFile, status

from app.models.message import AttachmentType
from app.services.images import process_upload
from app.services.storage import upload_object
from app.services.videos import process_video_upload


@dataclass
class ProcessedAttachment:
    attachment_type: AttachmentType
    url: str
    thumbnail_url: str | None


async def process_message_attachment(file: UploadFile) -> ProcessedAttachment:
    content_type = file.content_type or ""

    if content_type.startswith("image/"):
        processed = await process_upload(file)
        url = await asyncio.to_thread(
            upload_object, processed.original_bytes, processed.content_type, processed.extension
        )
        thumb_url = await asyncio.to_thread(
            upload_object, processed.thumbnail_bytes, processed.content_type, processed.extension
        )
        return ProcessedAttachment(attachment_type=AttachmentType.image, url=url, thumbnail_url=thumb_url)

    if content_type.startswith("video/"):
        url = await process_video_upload(file)
        return ProcessedAttachment(attachment_type=AttachmentType.video, url=url, thumbnail_url=None)

    raise HTTPException(
        status.HTTP_400_BAD_REQUEST,
        detail="Поддерживаются только изображения и видео",
    )
