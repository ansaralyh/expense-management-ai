from __future__ import annotations

from typing import Dict, List

import numpy as np
from sklearn.linear_model import LinearRegression

from app.schemas import ExpenseItem


def _monthly_totals(expenses: List[ExpenseItem]) -> tuple[List[str], np.ndarray]:
    buckets: Dict[str, float] = {}
    for item in expenses:
        key = item.date[:7]
        buckets[key] = buckets.get(key, 0.0) + float(item.amount)
    months = sorted(buckets)
    return months, np.array([buckets[month] for month in months], dtype=float)


def _shift_month(month_key: str, delta: int) -> str:
    year, month = [int(part) for part in month_key.split("-")]
    index = year * 12 + (month - 1) + delta
    return f"{index // 12}-{(index % 12) + 1:02d}"


def _weighted_recent_average(series: np.ndarray) -> float:
    recent = series[-3:] if len(series) >= 3 else series
    weights = np.array([0.5, 0.3, 0.2][-len(recent):], dtype=float)
    weights = weights / weights.sum()
    return float(np.dot(recent, weights))


def _spend_floor(series: np.ndarray) -> float:
    """Minimum plausible monthly spend — avoids hard-zero forecasts from negative trends."""
    avg = float(series.mean())
    wma = _weighted_recent_average(series)
    last = float(series[-1])
    return max(avg * 0.4, wma * 0.35, last * 0.25, 1.0)


def forecast_intervals(expenses: List[ExpenseItem], horizon: int = 6, draws: int = 400) -> dict:
    months, series = _monthly_totals(expenses)
    if len(series) < 4:
        raise ValueError("Add expenses in at least 4 different months before running the interval forecast.")

    spend_floor = _spend_floor(series)

    x = np.arange(len(series), dtype=float).reshape(-1, 1)
    model = LinearRegression().fit(x, series)
    fitted = model.predict(x)
    residuals = series - fitted
    if np.allclose(residuals, 0):
        residuals = np.array([max(series.mean() * 0.05, 1.0)])

    future_x = np.arange(len(series), len(series) + horizon, dtype=float).reshape(-1, 1)
    point = model.predict(future_x)
    # Keep trend above a soft floor so later months don't collapse to zero after bootstrap.
    point = np.maximum(point, spend_floor * 0.75)

    rng = np.random.default_rng(42)
    samples = np.zeros((draws, horizon))
    for draw in range(draws):
        noise = rng.choice(residuals, size=horizon, replace=True)
        samples[draw] = np.maximum(spend_floor, point + noise)

    last = months[-1]
    bands = []
    for step in range(horizon):
        column = samples[:, step]
        p10 = float(np.percentile(column, 10))
        p50 = float(np.percentile(column, 50))
        p90 = float(np.percentile(column, 90))
        # Safety net: if bootstrap still collapsed (edge case), anchor to floor / WMA decay.
        if p50 <= 0:
            anchor = max(spend_floor, _weighted_recent_average(series) * (0.98**step))
            p10 = max(p10, anchor * 0.85)
            p50 = max(p50, anchor)
            p90 = max(p90, anchor * 1.15)

        bands.append(
            {
                "month": _shift_month(last, step + 1),
                "p10": round(p10, 2),
                "p50": round(p50, 2),
                "p90": round(p90, 2),
                "point": round(float(point[step]), 2),
            }
        )

    ss_res = float(np.sum(residuals**2))
    ss_tot = float(np.sum((series - series.mean()) ** 2))
    r2 = 0.0 if ss_tot == 0 else 1 - ss_res / ss_tot
    return {
        "status": "success",
        "model": "Linear trend with residual bootstrap",
        "monthsUsed": len(series),
        "draws": draws,
        "r2": round(r2, 3),
        "spendFloor": round(spend_floor, 2),
        "history": [{"month": month, "total": round(float(total), 2)} for month, total in zip(months, series)],
        "bands": bands,
    }
