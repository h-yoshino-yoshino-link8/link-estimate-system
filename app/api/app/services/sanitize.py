"""String sanitizers mirrored from VBA logic."""

from __future__ import annotations

INVALID_FILE_CHARS = ['\\\\', '/', ':', '*', '?', '"', '<', '>', '|', '\\r', '\\n', '\\t']
INVALID_SHEET_CHARS = ['/', '\\\\', ':', '*', '?', '[', ']']


def sanitize_file_name(raw_name: str, fallback: str) -> str:
    cleaned = (raw_name or "").strip()
    for ch in INVALID_FILE_CHARS:
        cleaned = cleaned.replace(ch, "_")
    while "__" in cleaned:
        cleaned = cleaned.replace("__", "_")
    cleaned = cleaned.strip()
    return cleaned or fallback


def sanitize_sheet_name(raw_name: str, fallback: str) -> str:
    cleaned = (raw_name or "").strip()
    for ch in INVALID_SHEET_CHARS:
        cleaned = cleaned.replace(ch, "_")
    cleaned = cleaned.replace("\r", " ").replace("\n", " ").replace("\t", " ")
    while "  " in cleaned:
        cleaned = cleaned.replace("  ", " ")
    cleaned = cleaned.strip() or fallback
    return cleaned[:31]


def build_unique_sheet_name(base_name: str, existing_names: set[str]) -> str:
    candidate = base_name[:31]
    if candidate not in existing_names:
        return candidate
    counter = 2
    while True:
        suffix = f"_{counter}"
        candidate = f"{base_name[:31-len(suffix)]}{suffix}"
        if candidate not in existing_names:
            return candidate
        counter += 1
