import base64
import hashlib
import hmac
import secrets
import urllib.parse
import urllib.request

from django.conf import settings
from django.core.cache import cache
from rest_framework.exceptions import APIException, Throttled, ValidationError


class OtpDeliveryUnavailable(APIException):
    status_code = 503
    default_detail = "Phone verification is not configured right now. Please try again later."
    default_code = "otp_delivery_unavailable"


def _phone_key(phone_number):
    return hashlib.sha256(phone_number.encode("utf-8")).hexdigest()


def _otp_digest(phone_number, purpose, code):
    message = f"{phone_number}:{purpose}:{code}".encode("utf-8")
    return hmac.new(settings.SECRET_KEY.encode("utf-8"), message, hashlib.sha256).hexdigest()


def send_phone_otp(phone_number, purpose):
    account_sid = getattr(settings, "TWILIO_ACCOUNT_SID", "")
    auth_token = getattr(settings, "TWILIO_AUTH_TOKEN", "")
    from_number = getattr(settings, "TWILIO_FROM_NUMBER", "")
    if not (account_sid and auth_token and from_number) and not settings.DEBUG:
        raise OtpDeliveryUnavailable()
    if not getattr(settings, "TARA_OTP_CACHE_SHARED", False) and not settings.DEBUG:
        raise OtpDeliveryUnavailable()

    key = _phone_key(phone_number)
    rate_key = f"tara:otp:resend:{key}:{purpose}"
    tries = cache.get(rate_key, 0)
    if tries >= 3:
        raise Throttled(detail="Too many codes requested. Try again in an hour.")
    if cache.add(rate_key, 1, timeout=3600) is False:
        try:
            tries = cache.incr(rate_key)
        except ValueError:
            cache.set(rate_key, 1, timeout=3600)
            tries = 1
    else:
        tries = 1
    if tries > 3:
        raise Throttled(detail="Too many codes requested. Try again in an hour.")

    code = f"{secrets.randbelow(1_000_000):06d}"
    cache.set(f"tara:otp:code:{key}:{purpose}", _otp_digest(phone_number, purpose, code), timeout=600)
    cache.set(f"tara:otp:attempts:{key}:{purpose}", 0, timeout=600)

    if account_sid and auth_token and from_number:
        payload = urllib.parse.urlencode({"To": phone_number, "From": from_number, "Body": f"Your Tara verification code is {code}. It expires in 10 minutes."}).encode("utf-8")
        credentials = base64.b64encode(f"{account_sid}:{auth_token}".encode("utf-8")).decode("ascii")
        request = urllib.request.Request(
            f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json",
            data=payload,
            headers={"Authorization": f"Basic {credentials}", "Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                if response.status >= 300:
                    raise OtpDeliveryUnavailable()
        except Exception as exc:
            cache.delete(f"tara:otp:code:{key}:{purpose}")
            raise OtpDeliveryUnavailable() from exc
        return {"detail": "Verification code sent.", "expires_in_seconds": 600}

    return {"detail": "Development verification code generated. No SMS was sent.", "expires_in_seconds": 600, "development_code": code}


def verify_phone_otp(phone_number, purpose, code, *, consume=True):
    key = _phone_key(phone_number)
    otp_key = f"tara:otp:code:{key}:{purpose}"
    expected = cache.get(otp_key)
    if expected is None:
        raise ValidationError({"otp": "This code is missing or expired. Request a new one."})
    attempt_key = f"tara:otp:attempts:{key}:{purpose}"
    attempts = cache.get(attempt_key, 0)
    if attempts >= 5:
        cache.delete(otp_key)
        raise ValidationError({"otp": "Too many incorrect attempts. Request a new code."})
    actual = _otp_digest(phone_number, purpose, str(code or "").strip())
    if not hmac.compare_digest(expected, actual):
        try:
            cache.incr(attempt_key)
        except ValueError:
            cache.set(attempt_key, 1, timeout=600)
        raise ValidationError({"otp": "That code is incorrect. Please try again."})
    if consume:
        cache.delete(otp_key)
        cache.delete(attempt_key)
    return True
