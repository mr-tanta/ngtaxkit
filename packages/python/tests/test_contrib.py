"""Tests for framework integration modules — import and basic functionality."""
from __future__ import annotations

import pytest


class TestDjangoContrib:
    def test_import_fields(self) -> None:
        """Test that Django fields can be imported (Django may not be installed)."""
        try:
            from ngtaxkit.contrib.django import TINField, NairaField, VATCategoryField
            assert TINField is not None
            assert NairaField is not None
            assert VATCategoryField is not None
        except ImportError:
            pytest.skip("Django not installed")

    def test_import_template_tags(self) -> None:
        try:
            from ngtaxkit.contrib.django.templatetags import ngtaxkit_tags
            assert hasattr(ngtaxkit_tags, 'naira')
        except ImportError:
            pytest.skip("Django not installed")


class TestFlaskContrib:
    def test_import(self) -> None:
        try:
            from ngtaxkit.contrib.flask import create_blueprint, init_app, naira_filter
            assert callable(create_blueprint)
            assert callable(init_app)
        except ImportError:
            pytest.skip("Flask not installed")

    def test_naira_filter(self) -> None:
        try:
            from ngtaxkit.contrib.flask import naira_filter
            assert naira_filter(1234567.89) == "NGN 1,234,567.89"
            assert naira_filter(0) == "NGN 0.00"
            assert naira_filter(-500) == "-NGN 500.00"
        except ImportError:
            pytest.skip("Flask not installed")


class TestFastAPIContrib:
    def test_import(self) -> None:
        try:
            from ngtaxkit.contrib.fastapi import create_router, VatRequest, PayeRequest
            assert callable(create_router)
            assert VatRequest is not None
        except ImportError:
            pytest.skip("FastAPI not installed")

    def test_pydantic_models(self) -> None:
        try:
            from ngtaxkit.contrib.fastapi import VatRequest
            req = VatRequest(amount=100000)
            assert req.amount == 100000
            assert req.category == "standard"
            assert req.inclusive is False
        except ImportError:
            pytest.skip("FastAPI not installed")
