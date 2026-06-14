#!/usr/bin/env python3
"""Provisiona red + VM AMD Micro (backend FastAPI MVP)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from oci_client import MICRO_INSTANCE_NAME, OciKidepikClient


def main() -> int:
    client = OciKidepikClient()
    steps = [
        ("status", client.status()),
        ("network_ensure", client.network_ensure()),
        ("launch_micro", client.launch_micro_instance()),
    ]
    for name, result in steps:
        print(f"\n=== {name} ===", flush=True)
        print(json.dumps(result, indent=2, ensure_ascii=False), flush=True)
        if not result.get("ok"):
            return 1
    inst = client.instance_get(display_name=MICRO_INSTANCE_NAME)
    print("\n=== instance_get ===", flush=True)
    print(json.dumps(inst, indent=2, ensure_ascii=False), flush=True)
    return 0 if inst.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
