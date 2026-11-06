# Tara API Reference

This document groups the current backend API surface exposed by the Django app in `tara/backend`.

## Conventions

- Base HTTP prefix: `/api/`
- Auth: `Bearer <JWT access token>` unless marked as public
- WebSocket route is served separately from the HTTP `/api/` prefix
- Some `users` and `astrology` routes accept both trailing-slash and non-trailing-slash forms
- Matching routes are exposed twice in the current codebase:
  - directly under `/api/...`
  - again under `/api/matching/...`

## Auth

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | Public | Create a new account |
| `POST` | `/api/auth/login` | Public | Log in and receive auth payload |
| `POST` | `/api/auth/phone-status` | Public | Check whether a phone number already exists |
| `POST` | `/api/auth/forgot-password/reset` | Public | Reset password using phone-based lookup flow |
| `GET` | `/api/auth/me` | JWT | Fetch the current authenticated user |

## User Profile

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/profile/basic/` | JWT | Save basic profile fields |
| `POST` | `/api/profile/birth/` | JWT | Save birth info and regenerate kundali |
| `GET` | `/api/profile/me/` | JWT | Fetch the full current-user profile |
| `PATCH` | `/api/profile/extras/` | JWT | Update extra profile fields |
| `GET` | `/api/profile/photos/` | JWT | List profile photos |
| `POST` | `/api/profile/photos/` | JWT | Upload a profile photo |
| `POST` | `/api/profile/photos/reorder/` | JWT | Reorder profile photos |
| `DELETE` | `/api/profile/photos/<photo_id>/` | JWT | Delete a profile photo |

## Personality And Kundali

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/birth-details` | JWT | Save user birth details and return refreshed kundali payload |
| `GET` | `/api/kundali` | JWT | Fetch the stored kundali profile |
| `POST` | `/api/kundali-match` | JWT | Compute compatibility between two users |
| `GET` | `/api/horoscope/<sign>` | JWT | Fetch horoscope content for a sign |
| `GET` | `/api/personality/questions/` | JWT | List starter personality questions |
| `POST` | `/api/personality/response/` | JWT | Create or update a personality response |

## Astrology

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/astrology/birth-details` | JWT | Fetch astrology birth details for the current user |
| `POST` | `/api/astrology/birth-details` | JWT | Create or update astrology birth details |
| `PUT` | `/api/astrology/birth-details` | JWT | Replace astrology birth details |
| `GET` | `/api/astrology/kundali` | JWT | Fetch the astrology-module kundali |
| `GET` | `/api/astrology/daily-horoscope` | JWT | Fetch the cached daily horoscope |
| `GET` | `/api/astrology/location/search?q=...` | JWT | Search places for location suggestions |
| `GET` | `/api/astrology/location/reverse?latitude=...&longitude=...` | JWT | Reverse geocode coordinates into a place |

## Matching

Primary direct routes:

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/daily-recommendations/` | JWT | List generated daily recommendations |
| `GET` | `/api/recommendations/` | JWT | List swipeable recommendations |
| `POST` | `/api/swipe/like/` | JWT | Like a recommended user |
| `POST` | `/api/swipe/pass/` | JWT | Pass on a recommended user |
| `GET` | `/api/matches/` | JWT | List matched users |
| `GET` | `/api/matches/<match_id>/` | JWT | Fetch one match detail |
| `GET` | `/api/matches/<match_id>/icebreakers/` | JWT | Generate icebreaker suggestions for a match |

Discover recommendations include the counterpart's ordered `photos`, `bio`, `interests`, and `moon_sign`, plus `compatibility_score`, `kundali_score`, and `personality_score`. Scores are `null` for placeholder swipe matches rather than a fabricated zero. `POST /api/swipe/like/` accepts `target_user_id` and an optional `note` of up to 280 characters. Notes stay private until the like is mutual, then appear once in the match chat.

Alias routes exposed through `apps.matching.urls`:

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/matching/daily-recommendations/` | JWT | Alias of daily recommendations |
| `GET` | `/api/matching/recommendations/` | JWT | Alias of recommendations |
| `POST` | `/api/matching/swipe/like/` | JWT | Alias of swipe like |
| `POST` | `/api/matching/swipe/pass/` | JWT | Alias of swipe pass |
| `GET` | `/api/matching/matches/` | JWT | Alias of match list |
| `GET` | `/api/matching/matches/<match_id>/` | JWT | Alias of match detail |
| `GET` | `/api/matching/matches/<match_id>/icebreakers/` | JWT | Alias of match icebreakers |
| `GET` | `/api/matching/results/` | JWT | List stored match results |
| `POST` | `/api/matching/results/` | JWT | Create a stored match result |

## Chat

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/chat/messages/` | JWT | List chat messages owned by the current user |
| `POST` | `/api/chat/messages/` | JWT | Create a chat message record owned by the current user |
| `GET` | `/api/chat/<match_id>/messages/` | JWT | List messages for a specific match and mark unread incoming messages as read |
| `POST` | `/api/chat/<match_id>/message/` | JWT | Send a message to a matched user |

## Notifications

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/notifications/` | JWT | List notifications for the current user |
| `POST` | `/api/notifications/read/` | JWT | Mark selected or all unread notifications as read |

## Games

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/games/` | JWT | List active games |
| `POST` | `/api/games/start/` | JWT | Start a game session for a match |
| `GET` | `/api/games/session/<session_id>/question/` | JWT | Fetch the current or next session question |
| `POST` | `/api/games/answer/` | JWT | Submit a structured game answer |
| `POST` | `/api/games/respond/` | JWT | Submit or update a response for a question |

## WebSocket

| Protocol | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `WS` | `/ws/chat/<match_id>/` | JWT in query string middleware | Realtime chat events for a match |
