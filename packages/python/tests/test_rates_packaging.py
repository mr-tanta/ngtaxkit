"""Regression tests for packaged rate data."""

from __future__ import annotations

import json
from importlib.resources import files

from ngtaxkit import rates


def test_packaged_rate_files_are_available() -> None:
    """PyPI installs must include rate JSON under the ngtaxkit package."""
    vat_rates = files("ngtaxkit").joinpath("data/rates/vat_rates_2026.json")
    source_metadata = files("ngtaxkit").joinpath("data/rates/source_metadata_2026.json")

    assert vat_rates.is_file()
    assert source_metadata.is_file()
    assert json.loads(vat_rates.read_text(encoding="utf-8"))["version"] == rates.get_version()
    assert json.loads(source_metadata.read_text(encoding="utf-8"))["version"] == rates.get_version()
