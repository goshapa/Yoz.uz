from fastapi import APIRouter

from app.api.v1 import (
    admin,
    auth,
    bookmarks,
    feed,
    groups,
    messages,
    notifications,
    posts,
    push,
    reports,
    search,
    topics,
    users,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(posts.router)
api_router.include_router(feed.router)
api_router.include_router(topics.router)
api_router.include_router(bookmarks.router)
api_router.include_router(search.router)
api_router.include_router(notifications.router)
api_router.include_router(messages.router)
api_router.include_router(groups.router)
api_router.include_router(reports.router)
api_router.include_router(admin.router)
api_router.include_router(push.router)
