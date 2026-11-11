"""Farmers' crop-loss reports: the evidence behind field checks."""

from fastapi import APIRouter, Depends, HTTPException

from .. import data
from ..dependencies import get_dataset, get_policies, get_store
from ..policies import PolicyBook
from ..reports import ReportStore
from ..schemas import LossReportIn, LossReportOut, ReportCount

router = APIRouter(prefix="/api/loss-reports", tags=["Loss reports"])


@router.post("", response_model=LossReportOut, status_code=201, summary="Report a crop loss")
def report_loss(
    body: LossReportIn,
    ds: data.Dataset = Depends(get_dataset),
    store: ReportStore = Depends(get_store),
    policies: PolicyBook = Depends(get_policies),
) -> LossReportOut:
    """A farmer reports a crop loss. Reports count towards a field check for the district-season.
    The policy must exist and cover that district, so made-up policy numbers cannot add up to
    a field check."""
    if body.district not in ds.districts:
        raise HTTPException(422, f"Unknown district: {body.district}")
    policy = policies.get(body.policy_id) if body.policy_id in policies else store.policy(body.policy_id)
    if policy is None:
        raise HTTPException(422, f"No policy {body.policy_id}")
    if policy.district != body.district:
        raise HTTPException(422, f"Policy {body.policy_id} does not cover {body.district}")
    if policy.season is not None and body.season != policy.season:
        raise HTTPException(422, f"Policy {body.policy_id} covers Season A {policy.season} only")
    # Reports are taken where Field Checks can weigh them: seasons with harvest data, and
    # the season in progress.
    current = ds.current_season
    if (body.district, body.season) not in ds.calibration and not (current and body.season == current["season"]):
        raise HTTPException(422, f"No Season A {body.season} to report on")
    created = store.add(body.policy_id, body.district, body.season)
    return LossReportOut(created=created, reports=store.count(body.district, body.season))


@router.get("/summary", response_model=list[ReportCount], summary="Loss reports per district and season")
def summary(store: ReportStore = Depends(get_store)) -> list[ReportCount]:
    """Crop-loss reports on file, per district-season, with their causes."""
    return [ReportCount(district=d, season=s, reports=n, causes=store.causes(d, s)) for d, s, n in store.summary()]
