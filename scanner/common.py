"""Shared search criteria for the scan scripts."""
from datetime import date

MAX_KM = 50000
MAX_PRICE = 20000


def min_reg(today=None):
    """Earliest allowed first registration as 'YYYY-MM': the car must be under 4 years old.

    2026-10-29 gives '2022-11'. Moves forward one month each month.
    """
    t = today or date.today()
    y, m = t.year - 4, t.month + 1
    if m == 13:
        y, m = y + 1, 1
    return f"{y:04d}-{m:02d}"


def min_reg_year(today=None):
    return int(min_reg(today)[:4])
