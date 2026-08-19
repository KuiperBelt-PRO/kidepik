"""Constantes del progreso lineal por materia (SPEC_APP_SUBJECT_PROGRESS_LINEAR_B)."""

from __future__ import annotations

# Barra al 100% = rolling 1.0; subida de nivel en ese umbral.
THRESHOLD_UP = 1.0
SEED_ROLLING = 0.10  # 10% de barra inicial (10/100)
PATHS_PER_LEVEL_UP = 4
CHALLENGES_PER_PATH_NORM = 3
REQUIRED_CORRECT_CHALLENGES = PATHS_PER_LEVEL_UP * CHALLENGES_PER_PATH_NORM
DELTA_PER_CORRECT = (THRESHOLD_UP - SEED_ROLLING) / REQUIRED_CORRECT_CHALLENGES
ROLLING_MODEL = "linear_b"
