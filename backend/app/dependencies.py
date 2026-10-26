"""The objects the API is built from, provided to the routes through FastAPI's
dependency injection. Routes ask for what they need instead of reaching for
module globals, so tests can swap any of them (app.dependency_overrides)."""

from fastapi import Depends

from . import data
from .messaging import SmsGateway, SmsSettings, gateway_for
from .policies import PolicyBook
from .reports import ReportStore, default_store
from .ussd import UssdMenu

_policies = PolicyBook()


def get_dataset() -> data.Dataset:
    return data.load()


def get_store() -> ReportStore:
    return default_store()


def get_sms_settings() -> SmsSettings:
    # Read on every request, so a new key in backend/.env works without a restart.
    return SmsSettings.load()


def get_gateway(settings: SmsSettings = Depends(get_sms_settings), store: ReportStore = Depends(get_store)) -> SmsGateway:
    return gateway_for(settings, store)


def get_policies() -> PolicyBook:
    return _policies


def get_menu(
    ds: data.Dataset = Depends(get_dataset),
    store: ReportStore = Depends(get_store),
    gateway: SmsGateway = Depends(get_gateway),
    policies: PolicyBook = Depends(get_policies),
) -> UssdMenu:
    return UssdMenu(ds, store, gateway, policies)
