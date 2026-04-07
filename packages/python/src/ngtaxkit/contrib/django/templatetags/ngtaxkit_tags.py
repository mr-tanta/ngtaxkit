"""Django template tags for ngtaxkit."""
from __future__ import annotations

try:
    from django import template
except ImportError:
    raise ImportError("Django integration requires django.")

from ngtaxkit import vat as vat_module

register = template.Library()


@register.filter
def naira(value: float) -> str:
    """Format a number as Nigerian Naira: NGN 1,234,567.89"""
    if value is None:
        return "NGN 0.00"
    sign = "-" if value < 0 else ""
    abs_val = abs(float(value))
    whole = int(abs_val)
    decimal = round((abs_val - whole) * 100)
    return f"{sign}NGN {whole:,}.{decimal:02d}"


@register.filter
def vat_amount(value: float, category: str = "standard") -> str:
    """Calculate and format VAT for an amount."""
    result = vat_module.calculate(amount=float(value), category=category)
    return naira(result["vat"])


@register.filter
def vat_inclusive(value: float, category: str = "standard") -> str:
    """Calculate and format VAT-inclusive total."""
    result = vat_module.calculate(amount=float(value), category=category)
    return naira(result["gross"])


@register.simple_tag
def vat_rate(category: str = "standard") -> str:
    """Return the VAT rate for a category as a percentage string."""
    result = vat_module.calculate(amount=100, category=category)
    return f"{result['rate'] * 100:.1f}%"
