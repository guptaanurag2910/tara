from django.urls import path

from .views import BirthDetailsView, DailyHoroscopeView, KundaliView, LocationReverseView, LocationSearchView

urlpatterns = [
    path("birth-details/", BirthDetailsView.as_view(), name="astrology-birth-details"),
    path("birth-details", BirthDetailsView.as_view(), name="astrology-birth-details-no-slash"),
    path("kundali/", KundaliView.as_view(), name="astrology-kundali"),
    path("kundali", KundaliView.as_view(), name="astrology-kundali-no-slash"),
    path("daily-horoscope/", DailyHoroscopeView.as_view(), name="astrology-daily-horoscope"),
    path("daily-horoscope", DailyHoroscopeView.as_view(), name="astrology-daily-horoscope-no-slash"),
    path("location/search/", LocationSearchView.as_view(), name="astrology-location-search"),
    path("location/search", LocationSearchView.as_view(), name="astrology-location-search-no-slash"),
    path("location/reverse/", LocationReverseView.as_view(), name="astrology-location-reverse"),
    path("location/reverse", LocationReverseView.as_view(), name="astrology-location-reverse-no-slash"),
]
