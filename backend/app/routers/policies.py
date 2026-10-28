"""Policies farmers signed up for over USSD."""

from fastapi import APIRouter, Depends

from ..dependencies import get_store
from ..policies import is_web_demo, mask_phone
from ..reports import ReportStore
from ..schemas import RegisteredPolicy

router = APIRouter(prefix="/api/policies")


@router.get("", response_model=list[RegisteredPolicy])
def registered(store: ReportStore = Depends(get_store)) -> list[RegisteredPolicy]:
    """Every policy a farmer has signed up for, newest first. Phone numbers are masked."""
    return [
        RegisteredPolicy(**(p | {"phone": mask_phone(p["phone"]), "channel": "web" if is_web_demo(p["phone"]) else "ussd"}))
        for p in store.policies()
    ]
