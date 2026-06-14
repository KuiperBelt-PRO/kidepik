"""Carga credenciales OCI desde kidepik/.secrets/."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path

_ENV_LINE = re.compile(r"^\s*([^#=\s]+)\s*=\s*(.*)$")

_REQUIRED_KEYS = ("OCI_TENANCY_OCID", "OCI_USER_OCID", "OCI_FINGERPRINT", "OCI_REGION")


@dataclass(frozen=True)
class OciSettings:
    repo_root: Path
    tenancy_ocid: str
    user_ocid: str
    fingerprint: str
    region: str
    compartment_ocid: str
    namespace: str
    config_file: Path
    key_file: Path
    ssh_public_key_file: Path
    ssh_private_key_file: Path


def mcp_package_dir() -> Path:
    return Path(__file__).resolve().parent


def find_repo_root() -> Path:
    explicit = os.environ.get("KIDEPIK_REPO", "").strip()
    if explicit:
        return Path(explicit).resolve()
    # kidepik/.cursor/mcp-oci -> repo root
    candidate = mcp_package_dir().parent.parent
    if (candidate / ".secrets" / "oci.env").is_file():
        return candidate
    cwd = Path.cwd()
    for path in (cwd, *cwd.parents):
        if (path / ".secrets" / "oci.env").is_file():
            return path
    raise FileNotFoundError(
        "No se encontró kidepik/.secrets/oci.env. Define KIDEPIK_REPO o ejecuta desde el repo."
    )


def _resolve_path(repo_root: Path, value: str) -> Path:
    path = Path(value.strip())
    if path.is_absolute():
        return path
    return (repo_root / path).resolve()


def load_dotenv(repo_root: Path) -> None:
    env_file = repo_root / ".secrets" / "oci.env"
    if not env_file.is_file():
        raise FileNotFoundError(f"Falta {env_file}. Copia desde .secrets.sample/oci.env.sample")
    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        match = _ENV_LINE.match(raw_line)
        if not match:
            continue
        key, value = match.group(1), match.group(2).strip()
        os.environ.setdefault(key, value)


def get_settings() -> OciSettings:
    repo_root = find_repo_root()
    load_dotenv(repo_root)

    missing = [key for key in _REQUIRED_KEYS if not os.environ.get(key, "").strip()]
    if missing:
        raise ValueError(
            f"Faltan variables en .secrets/oci.env: {', '.join(missing)}. "
            "Ver .secrets.sample/oci.env.sample"
        )

    tenancy = os.environ["OCI_TENANCY_OCID"].strip()
    compartment = os.environ.get("OCI_COMPARTMENT_OCID", tenancy).strip() or tenancy
    config_rel = os.environ.get("OCI_CONFIG_FILE", ".secrets/oci.config").strip()
    key_rel = os.environ.get("OCI_KEY_FILE", ".secrets/oracle_private.pem").strip()
    ssh_pub = os.environ.get("OCI_SSH_PUBLIC_KEY_FILE", ".secrets/ssh/kidepik_oci.pub").strip()
    ssh_priv = os.environ.get("OCI_SSH_PRIVATE_KEY_FILE", ".secrets/ssh/kidepik_oci").strip()

    config_file = _resolve_path(repo_root, config_rel)
    key_file = _resolve_path(repo_root, key_rel)
    ssh_public = _resolve_path(repo_root, ssh_pub)
    ssh_private = _resolve_path(repo_root, ssh_priv)

    if not config_file.is_file():
        raise FileNotFoundError(f"Falta {config_file}")
    if not key_file.is_file():
        raise FileNotFoundError(f"Falta clave API {key_file}")

    return OciSettings(
        repo_root=repo_root,
        tenancy_ocid=tenancy,
        user_ocid=os.environ["OCI_USER_OCID"].strip(),
        fingerprint=os.environ["OCI_FINGERPRINT"].strip(),
        region=os.environ["OCI_REGION"].strip(),
        compartment_ocid=compartment,
        namespace=os.environ.get("OCI_NAMESPACE", "").strip(),
        config_file=config_file,
        key_file=key_file,
        ssh_public_key_file=ssh_public,
        ssh_private_key_file=ssh_private,
    )


def oci_sdk_config(settings: OciSettings) -> dict[str, str]:
    import oci

    config = oci.config.from_file(
        file_location=str(settings.config_file),
        profile_name="DEFAULT",
    )
    config["key_file"] = str(settings.key_file)
    oci.config.validate_config(config)
    return config
