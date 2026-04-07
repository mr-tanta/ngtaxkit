"""Flask integration for ngtaxkit — blueprint and Jinja2 filters."""
from __future__ import annotations
from typing import Any

try:
    from flask import Blueprint, jsonify, request
except ImportError:
    raise ImportError("Flask integration requires flask. Install with: pip install flask")

from ngtaxkit import vat as vat_module, paye as paye_module, wht as wht_module


# --- Jinja2 Filters -----------------------------------------------------------

def naira_filter(value: float) -> str:
    """Format a number as NGN X,XXX.XX"""
    if value is None:
        return "NGN 0.00"
    sign = "-" if value < 0 else ""
    abs_val = abs(float(value))
    whole = int(abs_val)
    decimal = round((abs_val - whole) * 100)
    return f"{sign}NGN {whole:,}.{decimal:02d}"


def vat_filter(value: float, category: str = "standard") -> str:
    """Calculate and format VAT amount."""
    result = vat_module.calculate(amount=float(value), category=category)
    return naira_filter(result["vat"])


# --- Blueprint ----------------------------------------------------------------

def create_blueprint(url_prefix: str = "/tax") -> Blueprint:
    """Create a Flask blueprint with tax calculation endpoints.

    Usage:
        from ngtaxkit.contrib.flask import create_blueprint
        app.register_blueprint(create_blueprint(), url_prefix="/api/tax")
    """
    bp = Blueprint("ngtaxkit", __name__)

    @bp.route("/vat/calculate", methods=["POST"])
    def calculate_vat() -> Any:
        data = request.get_json()
        try:
            result = vat_module.calculate(
                amount=data["amount"],
                inclusive=data.get("inclusive", False),
                category=data.get("category", "standard"),
                date=data.get("date"),
            )
            return jsonify(result)
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    @bp.route("/paye/calculate", methods=["POST"])
    def calculate_paye() -> Any:
        data = request.get_json()
        try:
            result = paye_module.calculate(
                gross_annual=data["grossAnnual"],
                pension_contributing=data.get("pensionContributing", False),
                nhf_contributing=data.get("nhfContributing", False),
                rent_paid_annual=data.get("rentPaidAnnual", 0),
            )
            return jsonify(result)
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    @bp.route("/wht/calculate", methods=["POST"])
    def calculate_wht() -> Any:
        data = request.get_json()
        try:
            result = wht_module.calculate(
                amount=data["amount"],
                payee_type=data["payeeType"],
                service_type=data["serviceType"],
            )
            return jsonify(result)
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    return bp


def init_app(app: Any) -> None:
    """Register ngtaxkit Jinja2 filters and blueprint with a Flask app.

    Usage:
        from ngtaxkit.contrib.flask import init_app
        init_app(app)
    """
    app.jinja_env.filters["naira"] = naira_filter
    app.jinja_env.filters["vat"] = vat_filter
    app.register_blueprint(create_blueprint(), url_prefix="/tax")
