from pydantic import BaseModel


class VapidKeyOut(BaseModel):
    public_key: str


class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionIn(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys


class PushStatusOut(BaseModel):
    subscribed: bool
