#!/usr/bin/env python3
"""Reintenta provision ARM hasta éxito con backoff adaptativo (sesiones largas)."""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from oci_client import OciKidepikClient

_FATAL_CODES = frozenset({"SSH_KEY_MISSING", "AUTH_FAILED"})

_TRANSIENT_MARKERS = (
    "toomanyrequests",
    "too many requests",
    "connection aborted",
    "remote end closed",
    "timeout",
    "temporarily unavailable",
    "service unavailable",
    "internalerror",
    "out of host capacity",
    "out of capacity",
)

_KIND_LABEL = {
    "capacity": "sin capacidad ARM",
    "rate_limit": "rate limit OCI",
    "network": "error de red transitorio",
    "other": "error transitorio",
}


def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _is_fatal(result: dict) -> bool:
    return result.get("error_code") in _FATAL_CODES


def _is_retryable(result: dict) -> bool:
    if result.get("ok"):
        return False
    if _is_fatal(result):
        return False
    return True


def _error_kind(result: dict) -> str:
    err = (result.get("error") or "").lower()
    code = result.get("error_code") or ""
    if code == "OUT_OF_CAPACITY" or "out of host capacity" in err or "out of capacity" in err:
        return "capacity"
    if "too many" in err or "toomanyrequests" in err:
        return "rate_limit"
    if code in ("TRANSIENT_ERROR", "NETWORK_FAILED", "LIST_INSTANCES_FAILED", "INSTANCE_GET_FAILED"):
        return "network"
    if any(m in err for m in ("connection", "remote end", "timeout", "unavailable")):
        return "network"
    if any(m in err for m in _TRANSIENT_MARKERS):
        return "other"
    return "other"


@dataclass
class BackoffState:
    """Backoff adaptativo por tipo de error consecutivo."""

    capacity_streak: int = 0
    rate_limit_streak: int = 0
    network_streak: int = 0
    other_streak: int = 0
    total_attempts: int = 0
    started_at: float = field(default_factory=time.monotonic)

    def record(self, kind: str) -> None:
        self.total_attempts += 1
        streak_map = {
            "capacity": "capacity_streak",
            "rate_limit": "rate_limit_streak",
            "network": "network_streak",
            "other": "other_streak",
        }
        streak_attr = streak_map.get(kind, "other_streak")
        prev = getattr(self, streak_attr)
        for attr in ("capacity_streak", "rate_limit_streak", "network_streak", "other_streak"):
            if attr != streak_attr:
                setattr(self, attr, 0)
        setattr(self, streak_attr, prev + 1)

    def wait_seconds(
        self,
        kind: str,
        *,
        capacity_base: float,
        rate_limit_base: float,
        network_base: float,
        other_base: float,
        max_backoff: float,
    ) -> float:
        if kind == "rate_limit":
            streak = self.rate_limit_streak
            raw = min(rate_limit_base * (2 ** (streak - 1)), max_backoff)
        elif kind == "network":
            streak = self.network_streak
            raw = min(network_base * (2 ** (streak - 1)), max_backoff / 2)
        elif kind == "capacity":
            streak = self.capacity_streak
            # Subida suave: +15s por fallo consecutivo (máx. +90s sobre la base)
            raw = min(capacity_base + 15.0 * (streak - 1), capacity_base + 90.0, max_backoff)
        else:
            streak = self.other_streak
            raw = min(other_base * (2 ** min(streak - 1, 4)), max_backoff)
        jitter = raw * random.uniform(-0.1, 0.1)
        floor = 20.0 if kind == "capacity" else 30.0
        return max(floor, raw + jitter)

    def summary(self) -> dict:
        elapsed = time.monotonic() - self.started_at
        return {
            "total_attempts": self.total_attempts,
            "elapsed_min": round(elapsed / 60, 1),
            "elapsed_h": round(elapsed / 3600, 2),
            "capacity_streak": self.capacity_streak,
            "rate_limit_streak": self.rate_limit_streak,
            "network_streak": self.network_streak,
            "other_streak": self.other_streak,
        }

    def elapsed_hours(self) -> float:
        return (time.monotonic() - self.started_at) / 3600.0


def _call_step(fn, *args, **kwargs) -> dict:
    try:
        return fn(*args, **kwargs)
    except Exception as exc:
        return {
            "ok": False,
            "error": str(exc),
            "error_code": "TRANSIENT_ERROR",
            "data": None,
        }


def _ensure_ready(client: OciKidepikClient, state: BackoffState, args: argparse.Namespace) -> bool:
    """Prepara red; reintenta ante fallos transitorios sin abortar la sesión."""
    pending = ("status", client.status), ("network_ensure", client.network_ensure)
    idx = 0
    while idx < len(pending):
        step_name, fn = pending[idx]
        result = _call_step(fn)
        print(f"[{_ts()}] {step_name}: ok={result.get('ok')}", flush=True)
        if result.get("ok"):
            idx += 1
            continue
        if _is_fatal(result):
            print(json.dumps(result, indent=2, ensure_ascii=False), flush=True)
            return False
        kind = _error_kind(result)
        state.record(kind)
        wait = state.wait_seconds(
            kind,
            capacity_base=args.capacity_interval,
            rate_limit_base=args.rate_limit_interval,
            network_base=args.network_interval,
            other_base=args.other_interval,
            max_backoff=args.max_backoff,
        )
        print(
            f"[{_ts()}] {step_name} falló ({result.get('error_code')}), "
            f"reintentando en {wait:.0f}s…",
            flush=True,
        )
        time.sleep(wait)
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Reintenta launch ARM hasta hueco OCI")
    parser.add_argument(
        "--capacity-interval",
        type=float,
        default=45.0,
        help="Espera base ante OUT_OF_CAPACITY en segundos (default: 45)",
    )
    parser.add_argument(
        "--attempts-per-minute",
        type=float,
        default=0.0,
        help="Atajo: intervalo capacidad = 60/N s (p. ej. 2 → cada 30s). 0 = usar --capacity-interval",
    )
    parser.add_argument(
        "--rate-limit-interval",
        type=float,
        default=120.0,
        help="Espera base ante 429 en segundos, luego x2 (default: 120)",
    )
    parser.add_argument(
        "--network-interval",
        type=float,
        default=45.0,
        help="Espera base ante error de red (default: 45)",
    )
    parser.add_argument(
        "--other-interval",
        type=float,
        default=90.0,
        help="Espera base ante otros errores transitorios (default: 90)",
    )
    parser.add_argument(
        "--max-backoff",
        type=float,
        default=600.0,
        help="Tope de espera entre intentos en segundos (default: 600)",
    )
    parser.add_argument(
        "--max-hours",
        type=float,
        default=24.0,
        help="Horas máximas de reintentos (0 = sin límite, default: 24)",
    )
    parser.add_argument("--display-name", default="kidepik-mvp")
    parser.add_argument(
        "--stats-every",
        type=int,
        default=5,
        help="Imprimir resumen cada N intentos (default: 5)",
    )
    args = parser.parse_args()
    if args.attempts_per_minute > 0:
        args.capacity_interval = 60.0 / args.attempts_per_minute

    client = OciKidepikClient()
    state = BackoffState()
    attempt = 0

    limit_msg = f"{args.max_hours}h" if args.max_hours > 0 else "sin límite"
    print(
        f"[{_ts()}] Estrategia: capacity={args.capacity_interval}s, "
        f"rate_limit={args.rate_limit_interval}s (x2), "
        f"network={args.network_interval}s, other={args.other_interval}s, "
        f"max_backoff={args.max_backoff}s, duración={limit_msg}",
        flush=True,
    )

    if not _ensure_ready(client, state, args):
        return 1

    while True:
        if args.max_hours > 0 and state.elapsed_hours() >= args.max_hours:
            print(
                f"[{_ts()}] PROVISION_TIMEOUT tras {state.elapsed_hours():.1f}h "
                f"({attempt} intentos de launch)",
                flush=True,
            )
            return 1

        attempt += 1
        print(f"\n[{_ts()}] === intento {attempt} ===", flush=True)
        result = _call_step(client.launch_arm_instance, display_name=args.display_name)
        if result.get("ok"):
            print(json.dumps(result, indent=2, ensure_ascii=False), flush=True)
        else:
            code = result.get("error_code", "?")
            err = (result.get("error") or "")[:200]
            print(f'{{"ok": false, "error_code": "{code}", "error": "{err}…"}}', flush=True)

        if result.get("ok"):
            inst = _call_step(client.instance_get, display_name=args.display_name)
            if not inst.get("ok"):
                print(f"[{_ts()}] Launch OK pero instance_get pendiente: {inst.get('error')}", flush=True)
            else:
                print(f"\n[{_ts()}] === ÉXITO tras {attempt} intentos ===", flush=True)
                print(json.dumps(inst, indent=2, ensure_ascii=False), flush=True)
            print("PROVISION_OK", flush=True)
            return 0

        if _is_fatal(result):
            print(f"[{_ts()}] Error fatal ({result.get('error_code')}), abortando.", flush=True)
            return 1

        if not _is_retryable(result):
            print(
                f"[{_ts()}] Error inesperado ({result.get('error_code')}), "
                "tratado como transitorio…",
                flush=True,
            )

        kind = _error_kind(result)
        state.record(kind)
        wait = state.wait_seconds(
            kind,
            capacity_base=args.capacity_interval,
            rate_limit_base=args.rate_limit_interval,
            network_base=args.network_interval,
            other_base=args.other_interval,
            max_backoff=args.max_backoff,
        )
        label = _KIND_LABEL.get(kind, kind)
        print(
            f"[{_ts()}] {label.capitalize()} — esperando {wait:.0f}s "
            f"(stats: {json.dumps(state.summary(), ensure_ascii=False)})",
            flush=True,
        )
        if attempt % args.stats_every == 0:
            print(f"[{_ts()}] STATS {json.dumps(state.summary(), ensure_ascii=False)}", flush=True)
        time.sleep(wait)


if __name__ == "__main__":
    raise SystemExit(main())
