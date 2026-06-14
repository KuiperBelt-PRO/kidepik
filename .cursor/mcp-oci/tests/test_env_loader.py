"""Tests del loader OCI (sin llamadas a la API)."""

from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from env_loader import find_repo_root, get_settings, load_dotenv


class EnvLoaderTests(unittest.TestCase):
    def test_find_repo_root_from_package(self) -> None:
        root = find_repo_root()
        self.assertTrue((root / ".secrets" / "oci.env").is_file())

    def test_missing_user_ocid_raises(self) -> None:
        root = find_repo_root()
        load_dotenv(root)
        with mock.patch.dict(os.environ, {"OCI_USER_OCID": ""}, clear=False):
            with self.assertRaises(ValueError) as ctx:
                get_settings()
            self.assertIn("OCI_USER_OCID", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
