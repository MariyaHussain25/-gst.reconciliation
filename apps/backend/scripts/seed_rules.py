"""Seed GST rules into MongoDB via the /api/rules/upload endpoint.

Reads every .txt file from apps/backend/data/rules/ and POSTs each one as a
multipart/form-data request to the running backend so the content gets chunked,
normalized into rule records, and persisted to MongoDB.

Usage (from the repo root or apps/backend/):
    python scripts/seed_rules.py [--base-url http://localhost:8000]
"""

import argparse
import os
import sys

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

RULES_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "rules")

# Map file name → (section label, category tag)
FILE_META: dict[str, tuple[str, str]] = {
    "chapter_v_itc.txt": ("Chapter V – Input Tax Credit", "ITC_ELIGIBILITY"),
    "chapter_3_rcm.txt": ("Chapter III – Reverse Charge Mechanism", "RCM"),
    "section_37_38_39_returns.txt": ("Sections 37–39 – GST Returns", "GENERAL"),
}


def seed(base_url: str) -> None:
    upload_url = f"{base_url.rstrip('/')}/api/rules/upload"
    rules_dir = os.path.abspath(RULES_DIR)

    if not os.path.isdir(rules_dir):
        print(f"[seed_rules] ERROR: rules directory not found: {rules_dir}", file=sys.stderr)
        sys.exit(1)

    txt_files = [f for f in os.listdir(rules_dir) if f.endswith(".txt")]
    if not txt_files:
        print(f"[seed_rules] ERROR: no .txt files found in {rules_dir}", file=sys.stderr)
        sys.exit(1)

    for filename in sorted(txt_files):
        file_path = os.path.join(rules_dir, filename)
        section, category = FILE_META.get(filename, ("", "GENERAL"))

        print(f"[seed_rules] Uploading '{filename}' → section='{section}', category='{category}' …")

        with open(file_path, "rb") as fh:
            response = requests.post(
                upload_url,
                files={"file": (filename, fh, "text/plain")},
                data={"section": section, "category": category},
                timeout=120,
            )

        if response.ok:
            body = response.json()
            chunks = body.get("chunks_saved", "?")
            print(f"[seed_rules]   ✓ {chunks} chunk(s) saved for '{filename}'.")
        else:
            print(
                f"[seed_rules]   ✗ Upload failed for '{filename}': "
                f"HTTP {response.status_code} — {response.text}",
                file=sys.stderr,
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed GST rules via the upload API.")
    parser.add_argument(
        "--base-url",
        default="http://localhost:8000",
        help="Base URL of the running backend (default: http://localhost:8000)",
    )
    args = parser.parse_args()
    seed(args.base_url)


if __name__ == "__main__":
    main()
