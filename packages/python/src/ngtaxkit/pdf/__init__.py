"""PDF document generators for ngtaxkit. Requires fpdf2: pip install ngtaxkit[pdf]"""

from __future__ import annotations


def _require_fpdf2():  # type: ignore[no-untyped-def]
    """Check that fpdf2 is installed, raise clear error if not."""
    try:
        import fpdf  # noqa: F401
        return fpdf
    except ImportError:
        raise ImportError(
            "PDF generation requires fpdf2. Install with: pip install ngtaxkit[pdf]"
        ) from None
