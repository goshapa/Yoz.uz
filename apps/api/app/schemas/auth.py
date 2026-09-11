from pydantic import BaseModel, EmailStr, Field

from app.schemas.user import UserMe


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResult(BaseModel):
    requires_2fa: bool = False
    challenge_token: str | None = None
    user: UserMe | None = None


class TwoFactorVerifyLoginRequest(BaseModel):
    challenge_token: str
    code: str


class TwoFactorSetupOut(BaseModel):
    secret: str
    provisioning_uri: str


class TwoFactorConfirmRequest(BaseModel):
    code: str


class TwoFactorDisableRequest(BaseModel):
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class MessageResponse(BaseModel):
    message: str
