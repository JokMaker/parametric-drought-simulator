# Backend: Drought Index Simulator API

FastAPI service that serves the calibrated drought index from the notebook's Step 12 export.

## Data (`data/`)

| File | Contents | Used for |
|---|---|---|
| `model.json` | scaler, Ridge coefficients, trigger/exit, low-yield threshold, validation | `/api/model`, index formula |
| `calibration.csv` | 21 district-seasons with yield data; `index_loo` is the leave-one-out prediction | Explorer for 2022/2023/2025, `/api/seasons`, `/api/basis-risk` |
| `seasons.csv` | every district-season with satellite data | Explorer for other seasons, `/api/history` |

For 2022, 2023 and 2025 the Explorer uses the leave-one-out index, so the comparison with
actual yield is honest. Other seasons use the model fitted on all 21 observations, so the same
season can show a slightly different index in the two files.

Index formula: standardise `rain_z` and `ndvi_z` with `scaler_mean` / `scaler_scale`, multiply by
`coefficients`, add `intercept` (`app/model.py`). Payout is 0 above the −7% trigger, 1 at or below
the −27% exit, linear in between.

## Endpoints

| Endpoint | Returns |
|---|---|
| `GET /api/model` | `ModelSummary` |
| `GET /api/simulate?district=Kirehe&season=2022` | `Simulation` |
| `GET /api/history` | `HistoryPoint[]` (`windowYear` = year of the Oct–Dec rains) |
| `GET /api/basis-risk` | `BasisRisk[]` |
| `GET /api/seasons` | `Simulation[]` (the 21 calibration district-seasons) |
| `GET /api/health` | row counts |

Shapes match `frontend/lib/types.ts`. Interactive docs at http://localhost:8000/docs.

## Run and test

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
.venv/bin/python -m pytest
```

`CORS_ORIGINS` (comma-separated, default `http://localhost:3000`) sets which dashboard origins may
call the API.
