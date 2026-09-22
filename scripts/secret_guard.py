"""Fail the build when a tracked file contains a high-confidence secret.

Prints file:line:kind only. Never prints the matched value.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    ".next",
    "coverage",
    "vendor",
    "__pycache__",
    ".venv",
    "venv",
    "tests",
    "test",
    "__tests__",
    "fixtures",
    "artifacts",
    "cache",
}
SKIP_FILES = {"secret_guard.py"}
PATTERNS = [
    ("aws_access_key", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("github_token", re.compile(r"ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}")),
    ("private_key_block", re.compile(r"-----BEGIN (?:RSA |OPENSSH |EC |PGP )?PRIVATE KEY-----")),
    ("live_secret_key", re.compile(r"sk_live_[A-Za-z0-9]{10,}")),
    ("provider_key", re.compile(r"sk-(?:ant-)?(?!test-)[A-Za-z0-9]{20,}")),
    ("google_api_key", re.compile(r"AIza[A-Za-z0-9_\-]{30,}")),
    ("slack_token", re.compile(r"xox[baprs]-[A-Za-z0-9-]{10,}")),
    (
        "assigned_hex_key",
        re.compile(r"(?i)(?:private[_ -]?key|mnemonic|seed)\s*[:=]\s*['\"]?(?:0x)?[a-f0-9]{64}"),
    ),
]
PLACEHOLDER = re.compile(
    r"(?i)(changeme|your[-_ ]|example|placeholder|xxxx+|\$\{|process\.env|os\.environ|REDACTED|dummy|fixture|wrong-fixture)"
)
CANARY = "abcdefghijklmnopqrstuvwxyz1234567890"


def main() -> int:
    hits: list[str] = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.name in SKIP_FILES:
            continue
        if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2", ".pdf", ".zip"}:
            continue
        if path.stat().st_size > 1_000_000:
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        rel = path.relative_to(ROOT).as_posix()
        for lineno, line in enumerate(text.splitlines(), 1):
            if CANARY in line or PLACEHOLDER.search(line):
                continue
            for kind, pattern in PATTERNS:
                if pattern.search(line):
                    hits.append(f"{rel}:{lineno}:{kind}")
                    break
    if hits:
        print(f"secret-guard: {len(hits)} hit(s)")
        print("\n".join(hits))
        return 1
    print("secret-guard: clean")
    return 0


if __name__ == "__main__":
    sys.exit(main())
