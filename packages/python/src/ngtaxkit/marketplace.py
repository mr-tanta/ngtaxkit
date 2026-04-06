"""Marketplace Module — Pure-function marketplace transaction calculator."""

from __future__ import annotations

from . import vat as vat_module
from . import wht as wht_module
from .types import (
    CommissionBreakdown,
    MarketplaceResult,
    TransactionBreakdown,
    VatLiability,
)
from .utils import bankers_round


def calculate_transaction(
    sale_amount: float,
    platform_commission: float,
    seller_vat_registered: bool,
    buyer_type: str = "individual",
    service_category: str = "standard",
    seller_tin: str | None = None,
    platform_is_vat_agent: bool = False,
    payment_date: str | None = None,
) -> MarketplaceResult:
    """Calculate the full tax breakdown for a marketplace buyer-seller transaction.

    1. VAT is calculated on the full sale_amount (not just commission).
    2. total_from_buyer = sale_amount + vat_amount.
    3. commission_amount = bankers_round(sale_amount × platform_commission).
    4. If seller is NOT VAT-registered, WHT is deducted from the seller payout.
    5. seller_payout = sale_amount − commission_amount − wht_amount.
    6. Balance invariant: total_from_buyer === seller_payout + commission + VAT + WHT
    """
    # 1. Calculate VAT on the full sale amount
    vat_result = vat_module.calculate(amount=sale_amount, category=service_category)
    vat_amount = vat_result["vat"]

    # 2. Total charged to buyer
    total_from_buyer = vat_result["gross"]

    # 3. Platform commission on the sale amount (pre-VAT)
    commission_amount = bankers_round(sale_amount * platform_commission)

    # 4. WHT: only when seller is NOT VAT-registered
    wht_result = None
    wht_amount = 0.0
    if not seller_vat_registered:
        wht_result = wht_module.calculate(
            amount=sale_amount,
            service_type="professional",
            payee_type="individual",
            payment_date=payment_date,
        )
        wht_amount = wht_result["wht_amount"]

    # 5. Seller payout — computed as residual to guarantee the balance invariant
    seller_payout = bankers_round(total_from_buyer - commission_amount - vat_amount - wht_amount)

    # 6. VAT liability assignment
    vat_collected_by: str = (
        "seller" if seller_vat_registered and not platform_is_vat_agent else "platform"
    )

    return MarketplaceResult(
        sale_amount=sale_amount,
        vat=vat_result,
        total_from_buyer=total_from_buyer,
        platform_commission=CommissionBreakdown(
            rate=platform_commission,
            amount=commission_amount,
            vat_on_commission=0.0,
            net_commission=commission_amount,
        ),
        seller_payout=seller_payout,
        wht=wht_result,
        vat_liability=VatLiability(
            collected_by=vat_collected_by,  # type: ignore[arg-type]
            amount=vat_amount,
            remitted_by=vat_collected_by,  # type: ignore[arg-type]
        ),
        breakdown=TransactionBreakdown(
            sale_amount=sale_amount,
            vat_amount=vat_amount,
            commission_amount=commission_amount,
            wht_amount=wht_amount,
            seller_payout=seller_payout,
            total_from_buyer=total_from_buyer,
        ),
    )
