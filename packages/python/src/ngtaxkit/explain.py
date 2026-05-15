"""Shared helpers for source-backed calculation explanations."""

from __future__ import annotations

from . import rates
from .types import RateSourceMetadata


def unique_rate_keys(rate_keys: list[str]) -> list[str]:
    """Return rate keys in first-seen order without duplicates."""
    return list(dict.fromkeys(rate_keys))


def collect_rate_sources(rate_keys: list[str]) -> tuple[list[RateSourceMetadata], list[str]]:
    """Collect source records for rate keys and warnings for weak or missing sources."""
    sources: list[RateSourceMetadata] = []
    warnings: list[str] = []

    for key in unique_rate_keys(rate_keys):
        try:
            source = rates.explain(key)
        except Exception as exc:
            warnings.append(f"{key}: source metadata unavailable. {exc}")
            continue

        sources.append(source)
        if source["verification_status"] != "verified":
            warnings.append(
                f'{key}: source status is {source["verification_status"]} '
                f'with {source["confidence"]} confidence. {source["notes"]}'
            )

    return sources, warnings
