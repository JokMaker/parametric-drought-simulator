"""The calibrated drought index and payout rule (proposal §3.9)."""

from dataclasses import dataclass


@dataclass(frozen=True)
class IndexModel:
    name: str
    scaler_mean: tuple[float, float]
    scaler_scale: tuple[float, float]
    coefficients: tuple[float, float]  # rain_z, ndvi_z
    intercept: float
    trigger: float
    exit: float

    def predict(self, rain_z: float, ndvi_z: float) -> float:
        """Predicted yield change (%). Inputs are each district's own z-scores;
        they are standardised again with the scaler fitted on the 21 calibration
        observations before the Ridge coefficients apply."""
        total = self.intercept
        for x, mean, scale, coef in zip(
            (rain_z, ndvi_z), self.scaler_mean, self.scaler_scale, self.coefficients
        ):
            total += coef * (x - mean) / scale
        return total

    def payout(self, index: float) -> float:
        """0 above the trigger, 1 at or below the exit, linear in between."""
        return payout(index, self.trigger, self.exit)


def payout(index: float, trigger: float, exit: float) -> float:
    share = (trigger - index) / (trigger - exit)
    return min(1.0, max(0.0, share))
