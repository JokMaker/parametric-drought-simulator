"""Edge cases for the drought index and payout rule (ALU accuracy-testing checklist).

The inputs are each district's rainfall and greenness z-scores: 0 is a normal
season, -1 happens about one season in six, and -3 is far outside the record.
"""

import math

import pytest

from app import data
from app.model import payout

MODEL = data.load().model
TRIGGER, EXIT = MODEL.trigger, MODEL.exit


def pays(rain_z: float, ndvi_z: float) -> float:
    return MODEL.payout(MODEL.predict(rain_z, ndvi_z))


def test_normal_season_pays_nothing():
    assert MODEL.predict(0, 0) == pytest.approx(2.9, abs=0.1)
    assert pays(0, 0) == 0


def test_extreme_drought_pays_in_full_and_no_more():
    assert MODEL.predict(-3, -3) < EXIT
    assert pays(-3, -3) == 1
    # Readings far beyond anything on record still cap at the full cover.
    assert pays(-50, -50) == 1


def test_extremely_wet_season_never_pays_a_negative_amount():
    assert MODEL.predict(3, 3) > 0
    assert pays(3, 3) == 0
    assert pays(50, 50) == 0


@pytest.mark.parametrize(
    "index,expected",
    [
        (TRIGGER, 0.0),  # exactly at the trigger: nothing yet
        (TRIGGER - 0.01, 0.0005),  # just past it: a token payout
        ((TRIGGER + EXIT) / 2, 0.5),  # halfway
        (EXIT + 0.01, 0.9995),  # just short of the exit
        (EXIT, 1.0),  # exactly at the exit: full cover
        (-math.inf, 1.0),
        (math.inf, 0.0),
    ],
)
def test_payout_at_the_boundaries(index, expected):
    assert payout(index, TRIGGER, EXIT) == pytest.approx(expected)


def test_payout_never_falls_as_the_index_falls():
    indices = [x / 10 for x in range(100, -400, -1)]
    shares = [payout(i, TRIGGER, EXIT) for i in indices]
    assert shares == sorted(shares)
    assert all(0 <= s <= 1 for s in shares)


def test_drier_or_browner_never_lowers_the_index_payout():
    # Both weights are positive, so a worse reading can only raise the payout.
    grid = [x / 2 for x in range(-6, 7)]
    for fixed in grid:
        rain_line = [pays(r, fixed) for r in grid]
        ndvi_line = [pays(fixed, n) for n in grid]
        assert rain_line == sorted(rain_line, reverse=True)
        assert ndvi_line == sorted(ndvi_line, reverse=True)


def test_greenness_outweighs_rainfall_when_they_disagree():
    # Severe rain deficit, normal crops: the index does not pay.
    assert pays(-3, 0) == 0
    # Normal rain, badly stressed crops: it pays in full.
    assert pays(0, -3) == 1
    # Opposite signals: greenness decides.
    assert pays(-3, 3) == 0
    assert pays(3, -3) == 1


def test_rainfall_alone_can_never_trigger_a_payout():
    # With normal greenness, even rainfall 5 SD below normal stays above the trigger:
    # a known limit of a model where greenness carries 93% of the weight.
    assert MODEL.predict(-5, 0) > TRIGGER


@pytest.mark.parametrize(
    "rain_z,ndvi_z",
    [(math.nan, 0), (0, math.nan), (math.nan, math.nan), (math.inf, 0), (0, -math.inf)],
)
def test_missing_or_broken_readings_are_refused(rain_z, ndvi_z):
    with pytest.raises(ValueError):
        MODEL.predict(rain_z, ndvi_z)


def test_missing_index_is_not_read_as_no_payout():
    with pytest.raises(ValueError):
        payout(math.nan, TRIGGER, EXIT)


def test_every_season_on_record_gives_a_valid_payout():
    rows = data.load().seasons.values()
    assert len(rows) == 175
    for r in rows:
        assert 0 <= pays(r.rain_z, r.ndvi_z) <= 1
