import re

HASHTAG_RE = re.compile(r"(?<!\w)#([^\s#@]{1,50})", re.UNICODE)
MENTION_RE = re.compile(r"(?<!\w)@([a-zA-Z0-9_]{3,20})")

_APOSTROPHE_VARIANTS = "'’ʻ‘ʼ`"
_APOSTROPHE_TRANSLATION = str.maketrans({ch: "'" for ch in _APOSTROPHE_VARIANTS})
_TRAILING_PUNCTUATION = ".,!?;:()[]{}\"'«»"


def normalize_apostrophes(text: str) -> str:
    """Приводит варианты узбекского апострофа (в `o‘`, `g‘` и т.п.) к единому
    символу, чтобы хэштеги и поиск не зависели от того, какой символ ввёл пользователь."""
    return text.translate(_APOSTROPHE_TRANSLATION)


def extract_hashtags(text: str | None) -> list[str]:
    if not text:
        return []
    tags: dict[str, None] = {}
    for match in HASHTAG_RE.finditer(text):
        tag = normalize_apostrophes(match.group(1)).lower().strip(_TRAILING_PUNCTUATION)
        if tag:
            tags.setdefault(tag, None)
    return list(tags.keys())


def extract_mentions(text: str | None) -> list[str]:
    if not text:
        return []
    usernames: dict[str, None] = {}
    for match in MENTION_RE.finditer(text):
        usernames.setdefault(match.group(1).lower(), None)
    return list(usernames.keys())
