"""Smoke test contra OCI real (requiere .secrets/ configurado)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Permite ejecutar como script sin instalar paquete
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from oci_client import OciKidepikClient


def main() -> int:
    client = OciKidepikClient()
    result = client.status()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
