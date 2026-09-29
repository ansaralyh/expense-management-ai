from app.schemas import ExpenseItem
from app.services.intervals import forecast_intervals


def _expenses_for_months(month_amounts: dict[str, float]) -> list[ExpenseItem]:
    items: list[ExpenseItem] = []
    counter = 0
    for month, amount in month_amounts.items():
        counter += 1
        items.append(
            ExpenseItem(
                id=str(counter),
                amount=amount,
                category="Food",
                date=f"{month}-15",
                transactionType="NEED",
                recurring=False,
                description="test",
            )
        )
    return items


def test_forecast_intervals_all_six_months_non_zero_with_negative_trend():
    expenses = _expenses_for_months(
        {
            "2026-04": 50000,
            "2026-05": 42000,
            "2026-06": 35000,
            "2026-07": 28000,
            "2026-08": 22000,
            "2026-09": 18000,
        }
    )
    result = forecast_intervals(expenses, horizon=6, draws=200)

    assert len(result["bands"]) == 6
    for step, band in enumerate(result["bands"], start=1):
        assert band["p10"] > 0, f"Month {step} p10 should be > 0"
        assert band["p50"] > 0, f"Month {step} p50 should be > 0"
        assert band["p90"] > 0, f"Month {step} p90 should be > 0"
        assert band["p10"] <= band["p50"] <= band["p90"]
