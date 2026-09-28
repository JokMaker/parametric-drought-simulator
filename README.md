# parametric-drought-simulator
Parametric drought-index insurance simulator for smallholder maize farmers in Eastern Rwanda (CHIRPS + MODIS NDVI, FastAPI, Next.js).

## Run it

**With Docker** (both services, one command):

```bash
docker compose up --build
```

Dashboard: http://localhost:3000 · API: http://localhost:8000/docs

**Without Docker**, in two terminals:

```bash
# Terminal 1: backend
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt   # first time only
.venv/bin/uvicorn app.main:app --reload --port 8000

# Terminal 2: frontend
cd frontend
npm install                                                               # first time only
printf 'NEXT_PUBLIC_API_URL=http://localhost:8000\nNEXT_PUBLIC_USE_MOCK=false\n' > .env.local
npm run dev
```

## Layout

- `backend/`: FastAPI API. Loads the notebook export in `backend/data/` (model.json,
  calibration.csv, seasons.csv). District-level numbers only.
- `frontend/`: Next.js dashboard (Overview, District Explorer, Drought History, Basis Risk).

Raw NISR survey files (`data/nisr/`, `*.sav`) are git-ignored: they are used for academic
calibration only and must not be redistributed (proposal §1.7.2).
