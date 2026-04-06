"""Error system for ngtaxkit — structured, typed errors with legal citations."""

from __future__ import annotations

import json
from typing import Any


# ─── Error Codes ──────────────────────────────────────────────────────────────

INVALID_AMOUNT = "NGTK_INVALID_AMOUNT"
INVALID_CATEGORY = "NGTK_INVALID_CATEGORY"
INVALID_SERVICE_TYPE = "NGTK_INVALID_SERVICE_TYPE"
INVALID_STATE = "NGTK_INVALID_STATE"
INVALID_PENSION_RATE = "NGTK_INVALID_PENSION_RATE"
INVALID_TIN = "NGTK_INVALID_TIN"
INVALID_DATE = "NGTK_INVALID_DATE"
RATE_NOT_FOUND = "NGTK_RATE_NOT_FOUND"
VALIDATION_ERROR = "NGTK_VALIDATION_ERROR"
INVALID_QUANTITY = "NGTK_INVALID_QUANTITY"
EMPTY_INVOICE = "NGTK_EMPTY_INVOICE"


# ─── Base Error ───────────────────────────────────────────────────────────────


class NgtaxkitError(Exception):
    """Base error class for all ngtaxkit errors."""

    def __init__(self, code: str, message: str, legal_basis: str | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.legal_basis = legal_basis

    def to_json(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "name": type(self).__name__,
            "code": self.code,
            "message": str(self),
        }
        if self.legal_basis is not None:
            result["legal_basis"] = self.legal_basis
        return result

    def __str__(self) -> str:
        return super().__str__()


# ─── Subclasses ───────────────────────────────────────────────────────────────


class InvalidAmountError(NgtaxkitError, ValueError):
    """Thrown when a monetary amount is invalid (e.g. negative)."""

    def __init__(self, message: str, legal_basis: str | None = None) -> None:
        NgtaxkitError.__init__(self, INVALID_AMOUNT, message, legal_basis)


class InvalidCategoryError(NgtaxkitError, ValueError):
    """Thrown when an unrecognised VAT category is provided."""

    def __init__(
        self,
        message: str,
        valid_categories: list[str],
        legal_basis: str | None = None,
    ) -> None:
        NgtaxkitError.__init__(self, INVALID_CATEGORY, message, legal_basis)
        self.valid_categories = valid_categories

    def to_json(self) -> dict[str, Any]:
        result = super().to_json()
        result["valid_categories"] = self.valid_categories
        return result


class InvalidServiceTypeError(NgtaxkitError, ValueError):
    """Thrown when an unrecognised WHT service type is provided."""

    def __init__(
        self,
        message: str,
        valid_service_types: list[str],
        legal_basis: str | None = None,
    ) -> None:
        NgtaxkitError.__init__(self, INVALID_SERVICE_TYPE, message, legal_basis)
        self.valid_service_types = valid_service_types

    def to_json(self) -> dict[str, Any]:
        result = super().to_json()
        result["valid_service_types"] = self.valid_service_types
        return result


class InvalidStateError(NgtaxkitError, ValueError):
    """Thrown when an invalid Nigerian state code is provided."""

    def __init__(
        self,
        message: str,
        valid_states: list[str],
        legal_basis: str | None = None,
    ) -> None:
        NgtaxkitError.__init__(self, INVALID_STATE, message, legal_basis)
        self.valid_states = valid_states

    def to_json(self) -> dict[str, Any]:
        result = super().to_json()
        result["valid_states"] = self.valid_states
        return result


class InvalidPensionRateError(NgtaxkitError, ValueError):
    """Thrown when a pension contribution rate is below the legal minimum."""

    def __init__(self, message: str, legal_basis: str | None = None) -> None:
        NgtaxkitError.__init__(self, INVALID_PENSION_RATE, message, legal_basis)


class InvalidTinError(NgtaxkitError, ValueError):
    """Thrown when a TIN is malformed or invalid."""

    def __init__(self, message: str, legal_basis: str | None = None) -> None:
        NgtaxkitError.__init__(self, INVALID_TIN, message, legal_basis)


class InvalidDateError(NgtaxkitError, ValueError):
    """Thrown when a date string is invalid or out of range."""

    def __init__(self, message: str, legal_basis: str | None = None) -> None:
        NgtaxkitError.__init__(self, INVALID_DATE, message, legal_basis)


class RateNotFoundError(NgtaxkitError, KeyError):
    """Thrown when a rate lookup fails (key not found in the registry)."""

    def __init__(self, message: str, legal_basis: str | None = None) -> None:
        NgtaxkitError.__init__(self, RATE_NOT_FOUND, message, legal_basis)

    def __str__(self) -> str:
        # KeyError wraps the message in quotes; override to match NgtaxkitError
        return Exception.__str__(self)


class ValidationError(NgtaxkitError, ValueError):
    """Thrown when one or more field-level validation errors occur."""

    def __init__(
        self,
        message: str,
        errors: list[dict[str, str]],
        legal_basis: str | None = None,
    ) -> None:
        NgtaxkitError.__init__(self, VALIDATION_ERROR, message, legal_basis)
        self.errors = errors

    def to_json(self) -> dict[str, Any]:
        result = super().to_json()
        result["errors"] = self.errors
        return result


class InvalidQuantityError(NgtaxkitError, ValueError):
    """Raised when a line item has zero or negative quantity."""

    def __init__(self, message: str, legal_basis: str | None = None) -> None:
        NgtaxkitError.__init__(self, INVALID_QUANTITY, message, legal_basis)


class EmptyInvoiceError(NgtaxkitError, ValueError):
    """Raised when an invoice has no line items."""

    def __init__(self, message: str, legal_basis: str | None = None) -> None:
        NgtaxkitError.__init__(self, EMPTY_INVOICE, message, legal_basis)
