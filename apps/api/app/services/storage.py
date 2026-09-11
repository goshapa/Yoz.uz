import json
import uuid
from functools import lru_cache

import boto3
from botocore.client import Config

from app.core.config import get_settings


@lru_cache
def get_s3_client():
    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
        config=Config(signature_version="s3v4"),
    )


def ensure_bucket() -> None:
    """Создаёт бакет для медиа при первом запуске и делает объекты в нём публично
    читаемыми — изображения постов отдаются напрямую по URL, без подписи запроса."""
    settings = get_settings()
    client = get_s3_client()
    try:
        client.head_bucket(Bucket=settings.s3_bucket)
    except Exception:
        client.create_bucket(Bucket=settings.s3_bucket)

    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": "*",
                "Action": "s3:GetObject",
                "Resource": f"arn:aws:s3:::{settings.s3_bucket}/*",
            }
        ],
    }
    client.put_bucket_policy(Bucket=settings.s3_bucket, Policy=json.dumps(policy))


def upload_object(data: bytes, content_type: str, extension: str) -> str:
    """Загружает объект в S3-совместимое хранилище и возвращает публичный URL."""
    settings = get_settings()
    client = get_s3_client()
    key = f"media/{uuid.uuid4().hex}.{extension}"

    client.put_object(
        Bucket=settings.s3_bucket,
        Key=key,
        Body=data,
        ContentType=content_type,
    )

    return f"{settings.s3_public_url}/{settings.s3_bucket}/{key}"
