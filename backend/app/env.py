"""Settings from backend/.env (git-ignored) or the environment; the environment wins.
The file is read on every call, so a new key works without restarting the server."""

import os
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


def read_env_file(path: Path = ENV_FILE) -> dict[str, str]:
    values: dict[str, str] = {}
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def setting(key: str, env_file: Path = ENV_FILE) -> str:
    # Strip, because a value pasted into a host's settings box can end in a line break.
    return (os.environ.get(key) or read_env_file(env_file).get(key, "")).strip()
