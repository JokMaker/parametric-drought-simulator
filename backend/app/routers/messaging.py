"""SMS and USSD through Africa's Talking."""

from urllib.parse import parse_qs

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse

from ..dependencies import get_gateway, get_menu, get_policies, get_sms_settings
from ..messaging import SmsError, SmsGateway, SmsSettings
from ..policies import PolicyBook
from ..schemas import SmsIn, SmsStatus, UssdPreviewIn, UssdPreviewOut
from ..ussd import UssdMenu, same_number

router = APIRouter(prefix="/api")


@router.get("/sms/status", response_model=SmsStatus)
def sms_status(settings: SmsSettings = Depends(get_sms_settings)) -> SmsStatus:
    """Whether SMS through Africa's Talking is set up (backend/.env), without revealing the key."""
    return SmsStatus(configured=settings.configured, sandbox=settings.sandbox, phone=settings.masked_phone)


@router.post("/sms")
def send_sms(body: SmsIn, gateway: SmsGateway = Depends(get_gateway)) -> dict:
    """Send a payout message to the demo phone through Africa's Talking."""
    if not gateway.settings.configured:
        raise HTTPException(503, "SMS is not set up: add AT_USERNAME, AT_API_KEY and AT_PHONE to backend/.env")
    try:
        receipt = gateway.send(body.message)
    except SmsError as e:
        raise HTTPException(502, str(e)) from e
    return receipt | {"phone": gateway.settings.masked_phone, "sandbox": gateway.settings.sandbox}


@router.post("/ussd", response_class=PlainTextResponse)
async def ussd_callback(
    request: Request,
    menu: UssdMenu = Depends(get_menu),
    settings: SmsSettings = Depends(get_sms_settings),
) -> str:
    """Africa's Talking calls this on every key press of a USSD session; the reply is the next screen.

    The form (sessionId, serviceCode, phoneNumber, text) is parsed with the standard
    library, so the backend needs no extra form-parsing package. The demo phone
    (AT_PHONE) holds the demo policy AT_POLICY; other numbers have none."""
    form = parse_qs((await request.body()).decode(), keep_blank_values=True)
    phone = form.get("phoneNumber", [""])[0]
    policy = menu.policies.get(settings.demo_policy) if same_number(phone, settings.phone) else None
    return menu.respond(form.get("text", [""])[0], policy)


@router.post("/ussd/preview", response_model=UssdPreviewOut)
def ussd_preview(body: UssdPreviewIn, menu: UssdMenu = Depends(get_menu), policies: PolicyBook = Depends(get_policies)) -> UssdPreviewOut:
    """The same USSD menu for a chosen demo policy, for the dashboard's phone screen."""
    if body.policy_id not in policies:
        raise HTTPException(422, f"Unknown demo policy: {body.policy_id}")
    return UssdPreviewOut(reply=menu.respond(body.text, policies.get(body.policy_id)))
