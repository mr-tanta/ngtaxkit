"""FastAPI integration for ngtaxkit — router and dependency injection."""
from __future__ import annotations
from typing import Any

try:
    from fastapi import APIRouter, HTTPException
    from pydantic import BaseModel, Field
except ImportError:
    raise ImportError("FastAPI integration requires fastapi and pydantic. Install with: pip install fastapi")

from ngtaxkit import vat as vat_module, paye as paye_module, wht as wht_module
from ngtaxkit import pension as pension_module, marketplace as marketplace_module
from ngtaxkit.errors import NgtaxkitError


# --- Request Models -----------------------------------------------------------

class VatRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Amount in Naira")
    inclusive: bool = Field(False, description="Whether amount is VAT-inclusive")
    category: str = Field("standard", description="VAT category")
    date: str | None = Field(None, description="ISO date for rate regime selection")

class PayeRequest(BaseModel):
    gross_annual: float = Field(..., alias="grossAnnual", gt=0)
    pension_contributing: bool = Field(False, alias="pensionContributing")
    nhf_contributing: bool = Field(False, alias="nhfContributing")
    rent_paid_annual: float = Field(0, alias="rentPaidAnnual")

class WhtRequest(BaseModel):
    amount: float = Field(..., gt=0)
    payee_type: str = Field(..., alias="payeeType")
    service_type: str = Field(..., alias="serviceType")
    payee_is_small_company: bool = Field(False, alias="payeeIsSmallCompany")

class PensionRequest(BaseModel):
    basic_salary: float = Field(..., alias="basicSalary", gt=0)
    housing_allowance: float = Field(0, alias="housingAllowance")
    transport_allowance: float = Field(0, alias="transportAllowance")

class MarketplaceRequest(BaseModel):
    sale_amount: float = Field(..., alias="saleAmount", gt=0)
    platform_commission: float = Field(..., alias="platformCommission")
    seller_vat_registered: bool = Field(..., alias="sellerVatRegistered")
    buyer_type: str = Field("individual", alias="buyerType")
    service_category: str = Field("standard", alias="serviceCategory")


# --- Router -------------------------------------------------------------------

def create_router(prefix: str = "/tax", tags: list[str] | None = None) -> APIRouter:
    """Create a FastAPI router with tax calculation endpoints.

    Usage:
        from ngtaxkit.contrib.fastapi import create_router
        app.include_router(create_router(), prefix="/api")
    """
    router = APIRouter(prefix=prefix, tags=tags or ["tax"])

    def handle_error(e: Exception) -> None:
        if isinstance(e, NgtaxkitError):
            raise HTTPException(status_code=400, detail=str(e))
        raise

    @router.post("/vat/calculate")
    async def calculate_vat(req: VatRequest) -> dict[str, Any]:
        try:
            return vat_module.calculate(
                amount=req.amount,
                inclusive=req.inclusive,
                category=req.category,
                date=req.date,
            )
        except Exception as e:
            handle_error(e)
            raise

    @router.post("/paye/calculate")
    async def calculate_paye(req: PayeRequest) -> dict[str, Any]:
        try:
            return paye_module.calculate(
                gross_annual=req.gross_annual,
                pension_contributing=req.pension_contributing,
                nhf_contributing=req.nhf_contributing,
                rent_paid_annual=req.rent_paid_annual,
            )
        except Exception as e:
            handle_error(e)
            raise

    @router.post("/wht/calculate")
    async def calculate_wht(req: WhtRequest) -> dict[str, Any]:
        try:
            return wht_module.calculate(
                amount=req.amount,
                payee_type=req.payee_type,
                service_type=req.service_type,
                payee_is_small_company=req.payee_is_small_company,
            )
        except Exception as e:
            handle_error(e)
            raise

    @router.post("/pension/calculate")
    async def calculate_pension(req: PensionRequest) -> dict[str, Any]:
        try:
            return pension_module.calculate(
                basic_salary=req.basic_salary,
                housing_allowance=req.housing_allowance,
                transport_allowance=req.transport_allowance,
            )
        except Exception as e:
            handle_error(e)
            raise

    @router.post("/marketplace/calculate")
    async def calculate_marketplace(req: MarketplaceRequest) -> dict[str, Any]:
        try:
            return marketplace_module.calculate_transaction(
                sale_amount=req.sale_amount,
                platform_commission=req.platform_commission,
                seller_vat_registered=req.seller_vat_registered,
                buyer_type=req.buyer_type,
                service_category=req.service_category,
            )
        except Exception as e:
            handle_error(e)
            raise

    return router
