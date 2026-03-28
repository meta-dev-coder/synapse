"""
GPS frame service — loads pre-sampled bus positions at module import.
Depends on datasets/bus_positions_sample.json produced by scripts/preprocess_gps.py.
"""
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_SAMPLE_PATH = Path(__file__).parent.parent.parent / "datasets" / "bus_positions_sample.json"

GPS_FRAMES: list[dict] = []

def _load_frames() -> list[dict]:
    if not _SAMPLE_PATH.exists():
        logger.warning(
            "GPS sample file not found at %s. "
            "Run scripts/preprocess_gps.py to generate it. "
            "GPS replay will be unavailable.",
            _SAMPLE_PATH,
        )
        return []
    try:
        with open(_SAMPLE_PATH, "r") as f:
            data = json.load(f)
        frames = data.get("frames", [])
        logger.info("Loaded %d GPS frames (%d buses in frame 0)",
                    len(frames), len(frames[0]["buses"]) if frames else 0)
        return frames
    except Exception as exc:
        logger.error("Failed to load GPS frames: %s", exc)
        return []


# Load at import time so the first API call has zero latency
GPS_FRAMES = _load_frames()


def get_frames() -> list[dict]:
    """Return all pre-loaded GPS frames. Empty list if sample file is missing."""
    return GPS_FRAMES
