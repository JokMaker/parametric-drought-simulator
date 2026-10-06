# Frontend: Drought Index Simulator dashboard

Next.js dashboard for the parametric drought-index simulator (Season A maize, Eastern Rwanda).

| Page | Route | Requirements |
|---|---|---|
| Overview | `/` | FR7, FR8, validation table |
| District Explorer | `/explorer?district=Gatsibo&season=2022` | FR1, FR3, FR5, FR6, FR7, FR9 |
| Drought History | `/history` | FR9 |
| Basis Risk | `/basis-risk` | FR10 |

## Run

```bash
npm install
npm run dev          # http://localhost:3000
```

Copy `.env.example` to `.env.local` to configure. Until the backend exists, `NEXT_PUBLIC_USE_MOCK`
defaults to `true` and every page uses `lib/mock.ts`. Set it to `false` to call the FastAPI backend.

## Backend contract

Shapes are in `lib/types.ts`. Endpoints (all GET):

- `/api/model` → `ModelSummary`
- `/api/simulate?district=&season=` → `Simulation`
- `/api/history` → `HistoryPoint[]`
- `/api/basis-risk` → `BasisRisk[]`
- `/api/seasons` → `Simulation[]` (the 28 district-seasons with yield data)

Requests come from the browser, so the backend must allow CORS from the dashboard's origin.

## Docker

`NEXT_PUBLIC_*` values are fixed at build time, so pass them as build args:

```bash
docker build -t drought-frontend \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:8000 \
  --build-arg NEXT_PUBLIC_USE_MOCK=false .
docker run -p 3000:3000 drought-frontend
```
