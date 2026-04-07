"""Django model fields for Nigerian tax data."""
from __future__ import annotations
from typing import Any

try:
    from django.db import models
except ImportError:
    raise ImportError("Django integration requires django. Install with: pip install django")


class TINField(models.CharField):
    """Nigerian Tax Identification Number field. Validates TIN format."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        kwargs.setdefault('max_length', 20)
        kwargs.setdefault('help_text', 'Nigerian Tax Identification Number (e.g., 12345678-0001)')
        super().__init__(*args, **kwargs)

    def validate(self, value: str, model_instance: Any) -> None:
        super().validate(value, model_instance)
        if value and len(value) < 8:
            from django.core.exceptions import ValidationError
            raise ValidationError('TIN must be at least 8 characters')


class NairaField(models.DecimalField):
    """Monetary field for Nigerian Naira with banker's rounding."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        kwargs.setdefault('max_digits', 15)
        kwargs.setdefault('decimal_places', 2)
        kwargs.setdefault('help_text', 'Amount in Nigerian Naira (NGN)')
        super().__init__(*args, **kwargs)


class VATCategoryField(models.CharField):
    """VAT category selector field."""

    VAT_CATEGORIES = [
        ('standard', 'Standard (7.5%)'),
        ('basic-food', 'Basic Food (Zero-rated)'),
        ('medicine', 'Medicine (Zero-rated)'),
        ('medical-equipment', 'Medical Equipment (Zero-rated)'),
        ('medical-services', 'Medical Services (Zero-rated)'),
        ('educational-books', 'Educational Books (Zero-rated)'),
        ('tuition', 'Tuition (Zero-rated)'),
        ('electricity', 'Electricity (Zero-rated)'),
        ('export-services', 'Export Services (Zero-rated)'),
        ('humanitarian-goods', 'Humanitarian Goods (Zero-rated)'),
        ('residential-rent', 'Residential Rent (Exempt)'),
        ('public-transport', 'Public Transport (Exempt)'),
        ('financial-services', 'Financial Services (Exempt)'),
        ('insurance', 'Insurance (Exempt)'),
    ]

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        kwargs.setdefault('max_length', 30)
        kwargs.setdefault('choices', self.VAT_CATEGORIES)
        kwargs.setdefault('default', 'standard')
        super().__init__(*args, **kwargs)
