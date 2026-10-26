"""Farmers' crop-loss reports: the evidence behind field checks."""

from fastapi import APIRouter, Depends, HTTPException

from .. import data
from ..dependencies import get_dataset, get_store
from ..reports import ReportStore
from ..schemas import LossReportIn, LossReportOut, ReportCount

router = APIRouter(prefix="/api/loss-reports")


@router.post("", response_model=LossReportOut, status_code=201)
def report_loss(body: LossReportIn, ds: data.Dataset = Depends(get_dataset), store: ReportStore = Depends(get_store)) -> LossReportOut:
    """A farmer reports a crop loss. Reports count towards a field check for the district-season."""
    if body.district not in ds.districts:
        raise HTTPException(422, f"Unknown district: {body.district}")
    current = ds.current_season
    if (body.district, body.season) not in ds.seasons and not (current and body.season == current["season"]):
        raise HTTPException(422, f"No Season A {body.season} to report on")
    created = store.add(body.policy_id, body.district, body.season)
    return LossReportOut(created=created, reports=store.count(body.district, body.season))


@router.get("/summary", response_model=list[ReportCount])
def summary(store: ReportStore = Depends(get_store)) -> list[ReportCount]:
    """Crop-loss reports on file, per district-season, with their causes."""
    return [ReportCount(district=d, season=s, reports=n, causes=store.causes(d, s)) for d, s, n in store.summary()]
