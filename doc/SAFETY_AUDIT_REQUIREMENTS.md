# Tara safety and personal data audit

**Status:** Baseline audit captured before safety implementation; see implementation status below.
**Scope:** Current Django data model and application configuration in this repository. This is not a legal/privacy compliance determination. Production infrastructure, backups, operators, and actual deletion behavior still need confirmation.

## 1. Data inventory

## Implementation status · 2026-10-30

Implemented in this codebase during the current safety pass:

- Shared backend report, block, moderation-action, appeal, and audit-event records; report intake for profiles and chat messages; reporter receipt/status API; moderator queue and action API.
- Web and mobile chat actions to report a profile/message, block, pause, or unmatch. Blocks close active chat sockets, expire active games, clear pair recommendations, prevent future recommendations, and stop chat/game authorization. Paused connections are hidden from chat/game entry points and can be resumed from match details.
- Web admin safety queue with evidence context and warning, seven-day messaging restriction, suspension, and ban actions.
- Server-backed privacy controls for discovery visibility, age, interests, and astrology. Exact birth date/time/place and coordinates are not included in public recommendation/match profile responses. Message notifications remain generic.
- Account JSON export and immediate account deletion endpoints, including profile-photo file cleanup; self-service controls exist in web and mobile settings.
- Adult age check at signup and birth-date update. Phone OTP send/verify/reset uses expiring codes, attempt limits, resend limits, optional Twilio delivery, and a development-only code response when `DEBUG=True`. Production delivery requires Twilio credentials and shared Redis (`REDIS_URL`). Signup and reset UIs use this flow.
- Scoped API throttles for signup, login/OTP, reports, blocks, and chat messages; astrology exception logs no longer include raw birth-place queries or coordinates.

Still needed before treating this as launch-ready:

- Optional selfie verification and badge definition; real repeated-account/fraud signals; complete appeal review and reinstatement UI; automatic expiry/enforcement for temporary restrictions; stronger authentication for moderators.
- Safety date plans, trusted-contact sharing, and post-date check-ins; message spam/abuse/link/photo detection and per-message hide controls; notification preview preference.
- Report flows from every profile/game/photo surface; complete block enforcement for every game-night/realtime/notification path; explicit durable pause ownership/state; export of all game/photo/notification data and game-photo file cleanup on deletion.
- Approved retention periods and automated deletion jobs. Current account deletion is immediate for cascading database data and profile photos; reports may retain minimized evidence snapshots. Database/media backups and external systems are not purged by this endpoint.
- Authenticated or signed private-media delivery, production DB/media/backup/operator mapping, incident response and response-time staffing, and deployment validation of HTTPS, secrets, shared cache, and SMS configuration.

The app code acknowledges an urgent underage report as urgent, but does not automatically suspend the reported account. Moderator action remains a human decision.

| Data | What Tara stores | Where it is stored today | Who can access it today | Retention in code |
|---|---|---|---|---|
| Account and contact | Name, email, phone, password hash, account status, join/login timestamps | `users.User` in the configured relational database (PostgreSQL outside test configuration) | Account owner through authenticated account flows; staff/superusers through Django admin; admin-portal operators with admin access. Database operators depend on deployment | No expiry policy found. User deletion cascades through many related rows, but backup/log copies are not addressed |
| Profile and preferences | Bio, interests, gender, match preference, notification preferences | `users.User` database row | Owner; fields returned in profile/discovery APIs according to serializers; staff/superusers and admin-portal operators | No expiry policy found |
| Photos | Up to five profile images; game photo submissions | `UserProfileImage.image` and `GameResponse.photo` file fields; local config uses `MEDIA_ROOT = backend/media` | Profile photos are exposed to app flows and admin tooling. Game photos are attached to game responses. Admins can view image links/previews. Exact user-to-user visibility depends on the corresponding API/game state | Database rows cascade on account deletion; physical file deletion is not guaranteed by Django's `FileField`. No age-based cleanup found |
| Birth and location details | Date/time of birth, place of birth, latitude/longitude; duplicated between `User` and `astrology.BirthDetails` | `users.User`, `astrology.BirthDetails`; derived astrology chart data in `Kundali`/`KundaliProfile` | Owner via astrology/profile APIs; admins can view birth fields; admin portal returns DOB, birthplace and birth time. Coordinates are used for astrology calculations. This code stores birth-location coordinates; it does not establish that Tara continuously tracks live device location | No expiry policy found |
| Personality and compatibility | Questionnaire answers, trait JSON, Kundali chart/signs, compatibility scores and insights | `PersonalityResponse`, `Trait`, `KundaliProfile`, `astrology.Kundali`, match/recommendation records | Owner-facing profile/match features; staff/superusers and admin portal can inspect related records and scores | No expiry policy found |
| Messages and game content | Direct messages, game event payloads, reactions, read/delivery state; game answers, story text, rankings, truth/lie statements, photos; game-night messages | `chat.Message`, `realtime.Message`, `games.GameResponse`, `matching.GameNightMessage` and related session rows | Conversation participants through the app; staff/superusers can inspect messages in Django admin; admin portal currently exposes conversation data to authorized admin users. Game responses are visible to the relevant participants according to game state | No expiry policy found. Related records generally cascade on account/match/session deletion |
| Discovery and relationship activity | Swipes, recommendations and scores, matches, game invitations/session state, blocks/passes/status | `matching` and `realtime` database models | The two users see their own relevant discovery/match state; staff/superusers and admin portal can inspect operational records | No expiry policy found; cascading behavior varies by foreign key |
| Reports and safety events | A free-text reason for an existing game-night report; room/reporter/time | `matching.GameNightReport` in the database | Reporter submits through the authenticated game-night endpoint; admins can view it in Django admin | No expiry policy found. This is not yet a general user/profile/message reporting system and has no structured category or moderation case/action history |
| Notifications | Notification text, actor name, action URL, read state | `notifications.Notification` in the database | Recipient and staff/admin users | No expiry policy found |

### Storage and access notes

- `backend/config/settings.py` configures a relational database and local `MEDIA_ROOT`; it does not define a separate object-storage backend in the inspected settings. Production deployment may override this, so the deployed database, media provider, backup region, encryption, and access principals must be recorded before launch.
- `MEDIA_URL` is `/media/`, and `SERVE_MEDIA` currently defaults to `true`; `config/urls.py` adds a static media route when that setting is true. That route is not an authenticated-media implementation. Treat uploaded photos as potentially retrievable by URL and verify/fix production media access before storing sensitive images.
- Django admin is available at `/admin/`. The custom admin portal exposes user contact/profile details and profile-photo URLs, and conversation tooling is available. Access should be limited to named, least-privilege staff accounts, protected with strong authentication, and audited. Do not grant broad admin access for routine support.
- Logs, analytics, crash reports, email/SMS providers, backups, and third-party processors were not fully mapped by this code review. Confirm whether any contain identifiers, message snippets, coordinates, or photo URLs.

## 2. Required retention and deletion policy

The current code does not establish a retention schedule. Adopt and implement a policy before launch; recommended baseline for product/legal review:

1. Keep account/profile data only while the account is active, plus a short deletion grace period if account recovery is offered.
2. On account deletion, delete or irreversibly de-identify profile, birth, personality, recommendation, swipe, match, message, game, notification, and uploaded-file data unless a documented legal/safety hold applies.
3. Retain reports and moderation audit records only for a documented safety/legal period; restrict access and remove unnecessary message/photo content from the case record.
4. Set explicit cleanup windows for expired sessions, abandoned game content, delivery metadata, and operational logs. Backups must age out on a documented schedule; deletion from the live database alone is not full erasure.
5. Provide a deletion workflow that handles database rows, media files, search/index/cache copies, exports, and backup expiry, and records completion without retaining unnecessary personal data.

These are proposed requirements, not current behavior or a legal retention period.

## 3. Report categories

Every report should capture a structured category, reported user, reporter, timestamp, target type/ID, and optional explanation. Preserve only the minimum evidence needed for review.

| Category | Use when | Priority guidance |
|---|---|---|
| Harassment | Repeated unwanted contact, bullying, hate, coercion, threats, or sexual harassment | Urgent for threats, stalking, sexual coercion, or credible imminent harm; otherwise standard |
| Impersonation | Someone is pretending to be the reporter, another person, or an organization | Standard; urgent when used for exploitation, threats, or account takeover |
| Scam | Fraud, romance scam, payment requests, phishing, extortion, or attempts to move users to unsafe payment channels | Urgent for active extortion, financial exploitation, or ongoing victimization; otherwise standard |
| Unsafe content | Explicit, violent, exploitative, non-consensual, or otherwise prohibited content | Urgent for sexual exploitation, intimate images shared without consent, or credible threats; otherwise standard |
| Underage user | Suspected user is below the service's minimum age, or content suggests a minor is at risk | Always urgent; immediately restrict discovery/contact while reviewed under the child-safety process |
| Other | A safety concern that does not fit the categories above | Triage based on described harm; allow reporter to add a short explanation |

Reports must be private to the reporter and authorized reviewers. Do not notify the reported person who filed the report. Prevent duplicate spam without suppressing distinct evidence or follow-up reports.

## 4. Moderation actions

| Action | Meaning | Minimum requirements |
|---|---|---|
| Warning | A documented notice explaining the violated rule and expected change | Record policy reason, evidence reference, reviewer, timestamp, and delivery status; repeated violations can escalate |
| Temporary restriction | Time-limited restriction of a specific capability (for example messaging, discovery, games, or photo upload) | Specify scope, start/end time, reason, and review/appeal path; avoid disabling unrelated safety/account controls |
| Suspension | Temporary account-level lock while a serious case is investigated or as a penalty | State duration or review date, reason code, reviewer, appeal route, and whether sessions/tokens are revoked |
| Permanent ban | Account termination for severe/repeated violations | Require documented evidence and authorized reviewer; revoke sessions, prevent reactivation through the account, preserve only approved safety records, and provide an appeal process where appropriate |

All actions should be reversible where appropriate, tied to a report/case, and written to an append-only moderation audit trail. Separate the person who reports from the person who decides where staffing allows. Add escalation for imminent danger, child safety, and legal requests.

## 5. Proposed response targets

These are service targets to adopt only after staffing and coverage are in place. They are not current guarantees. The app should immediately confirm receipt and provide in-product safety guidance regardless of review time.

| Priority | Examples | Target |
|---|---|---|
| Urgent | Suspected minor, credible threat/imminent harm, sextortion, sexual exploitation, non-consensual intimate imagery, active scam causing immediate harm | Human triage within **1 hour** during staffed/on-call coverage; apply protective restrictions immediately when justified; provide a status update or next step within **24 hours** |
| Standard | Non-imminent harassment, impersonation, scam attempt, unsafe content, other policy concern | First human review within **24 hours**; resolution or progress update within **72 hours** |

If Tara cannot provide urgent on-call coverage, publish the actual coverage window clearly and provide emergency guidance appropriate to the user's region. Never imply emergency services are monitored by the report queue.

## 6. Implementation checklist

- [ ] Confirm production database, media storage, regions, encryption, backup expiry, logs, analytics, and third-party processors.
- [ ] Decide and publish retention periods, account deletion behavior, safety holds, and appeal windows.
- [ ] Replace public media serving with authenticated/signed, authorization-checked delivery where the media is private; verify profile-photo visibility expectations.
- [ ] Add a general report model/API/UI with the six categories, target references, evidence handling, status, priority, assignment, and timestamps.
- [ ] Add moderation case/action records with the four action types, duration/scope, reason, actor, audit trail, and appeals.
- [ ] Add reviewer roles and least-privilege access to admin portal; log access to sensitive report evidence and user records.
- [ ] Implement urgent/standard queues, timers, escalation, reporter receipt/status updates, and staffing coverage.
- [ ] Create playbooks for underage reports, imminent threats, intimate-image abuse, scam reports, account appeals, and law-enforcement requests.
- [ ] Exercise the lifecycle from report submission through review, action, appeal, deletion/retention, and audit.

## 7. Code references reviewed

- `backend/apps/users/models.py`
- `backend/apps/astrology/models.py`
- `backend/apps/chat/models.py`
- `backend/apps/games/models.py`
- `backend/apps/matching/models.py`
- `backend/apps/notifications/models.py`
- `backend/apps/realtime/models.py`
- `backend/apps/matching/game_night_views.py`
- `backend/config/admin_portal.py`
- `backend/config/settings.py`
- `backend/config/urls.py`

## 8. Account authenticity and age

### Current implementation found

- Phone numbers are normalized and unique, but the user model has no `phone_verified` state or verification timestamp.
- Signup currently accepts the fixed OTP `123456` in `users/serializers.py`; password reset accepts the same fixed value. This is a development bypass, not phone ownership verification, and must be removed before production.
- The `phone-status` endpoint reports whether a phone number exists. It can enable account enumeration and currently has no endpoint-level throttling found in the inspected code.
- Signup does not require a date of birth or enforce age there. The phone signup path supplies a default adult birth date. An 18+ check exists in profile/birth serializers, which happens after account creation and is not an adequate signup age gate by itself.
- No selfie/identity-verification workflow, repeated-signup/spam risk controls, or user appeal workflow was found.
- `is_active` is used to prevent inactive accounts from logging in, but it does not record why an account is restricted, who made the decision, duration, evidence, or appeal state.

### Product behavior and implementation tasks

1. **Phone ownership verification**
   - Require a verified phone before the account can enter discovery, send messages, or create game sessions; allow a limited onboarding state before verification.
   - Replace the fixed OTP with a cryptographically random, short-lived, single-use challenge sent through an approved SMS provider. Store only a protected challenge representation, expiry, attempt count, send count, and verification state; never log OTP values.
   - Add resend cooldowns and daily/hourly budgets per phone, IP/device signal, and account. Apply escalating delays, generic responses, and provider spend limits to reduce enumeration and SMS pumping. Add bot friction when risk signals justify it.
   - Verify the phone-status endpoint does not reveal whether a number is registered; use the same response shape and timing for both cases, or remove it from unauthenticated flows.
   - Support number changes by re-verifying the new number and retaining a security event for the change.

2. **Age gate and suspected-underage review**
   - Require date of birth before creating an active account. Calculate age server-side using the user's local date and an explicit minimum age of 18; do not trust a client-supplied “adult” boolean or default DOB.
   - Reject underage signup before creating an account or generating recommendations. Show a concise, non-judgmental message and avoid collecting profile/photos from a rejected minor.
   - Add an underage report/review state. On credible suspicion, immediately pause discovery and new contact while trained reviewers assess the case; preserve minimum necessary evidence and apply the child-safety escalation playbook.
   - Define how a user can correct a genuine DOB mistake without exposing them to other users. Where age assurance is needed, use a privacy-preserving specialist flow and keep Tara's retained result to a minimal status/assurance record where possible.

3. **Optional selfie verification**
   - Offer only after explaining that it is optional, what image/biometric processing occurs, which provider receives it, how long evidence is retained, and how to appeal a rejection. Provide a usable non-selfie path and never imply it proves safety, identity, age, or good behavior beyond the exact checks performed.
   - Define the badge precisely (for example: “Selfie checked: a live selfie was compared with the profile photos on [date]”). Make the badge a limited signal, not a guarantee of identity or trustworthiness.
   - Prefer a vendor that returns a verification result without requiring Tara to store face templates. If evidence must be retained, restrict access and set a short deletion window. Record provider, result, timestamp, and policy version; do not store biometric templates in Tara without a separate necessity, privacy, and legal review.

4. **Repeated signup, spam, and suspicious behavior**
   - Add shared throttles and risk signals for signup, OTP send/verify, login, password reset, profile/photo upload, messaging, likes/swipes, and reports. Enforce limits server-side across app instances.
   - Detect patterns such as many accounts per phone/device/network, rapid OTP retries, repeated failed verification, high-volume likes/messages, duplicate profile content, and rapid account recreation after restrictions. Use risk scoring to trigger progressive friction and human review rather than automatic permanent bans from a single signal.
   - Minimize and define retention for device/network identifiers; document purpose, access, and deletion. Provide a way to correct false positives.

5. **Verification and restriction appeals**
   - Show a clear, non-sensitive reason and next step when verification fails or a capability/account is restricted. Never expose internal fraud rules or another user's report identity.
   - Provide an in-app appeal submission, case reference, evidence upload only when needed, status updates, and a human review path. Use a different reviewer for severe/permanent actions where staffing allows.
   - Track the restriction reason, scope, start/end/review time, reviewer, appeal state, and outcome in an auditable case system. Avoid relying on a bare `is_active` flag as the sole enforcement record.

### Acceptance criteria

- A user cannot access discovery or initiate contact until phone verification is completed; OTP resend and verification attempts are rate-limited and observable without logging secrets.
- Signup requires a real DOB and enforces the 18+ policy server-side before account activation; rejected underage attempts do not create usable accounts or recommendation records.
- Users can submit suspected-underage reports and affected users enter the defined protected review flow.
- Selfie verification remains optional, with clear badge language, data/retention disclosure, and an appeal path; opting out does not silently block ordinary onboarding.
- Risk controls cover repeated account creation and high-velocity behavior, with a human-review route for consequential restrictions and a path to appeal false positives.

## 9. Privacy controls

### Current implementation found

- Tara stores exact latitude/longitude and birth-place data for astrology. `UserSerializer` includes exact birth date/time/place and coordinates and is used by the authentication response and `/api/auth/me`; profile-birth endpoints also return exact birth details to the account owner. Matching serializers inspected expose age/profile content but not the coordinates. There is no explicit public “approximate area” presentation or profile visibility setting in the user model.
- Profile fields are mostly fixed in serializers rather than controlled per-field by the user. Notification preferences can toggle matches, messages, and game turns, but there is no “hide message content on lock screen” setting.
- Birth details support astrology calculations and timezone/location resolution, but onboarding/API copy explaining the need for DOB, time, place, and coordinates was not found in the backend review. Product copy still needs a frontend review.
- Users can delete individual profile photos. No account export/download or account deletion endpoint was found. Django cascade deletion alone would not guarantee uploaded-file deletion or cleanup from backups and external systems.
- In-app message notifications use generic text (“[name] sent you a message”) rather than the private message body. This is a good baseline for previews. No APNs/FCM delivery integration was found in the inspected notification service; review mobile/local notification behavior separately before release.
- No retention lifecycle was found for deleted accounts, reports, or moderation evidence. The retention proposal in section 2 remains undecided.

### Product behavior and implementation tasks

1. **Location privacy**
   - Keep precise birth coordinates private to the account and the astrology service. Never return raw coordinates, birth-place text, or live location to another user or in a public profile response.
   - If approximate distance/area is a product feature, derive a coarse area server-side (for example, a broad city/region label or rounded distance band), make disclosure opt-in, and do not return coordinates from the API. Avoid an exact distance that lets someone triangulate a home location through repeated queries.
   - Separate birth location used for astrology from any future discovery/current-location feature. Ask separately, explain purpose, minimize precision, and provide a disable/delete control.

2. **Profile visibility controls**
   - Add clear per-field visibility choices (for example: visible to matches, visible to accepted connections, private) for optional profile fields, plus an account-level discovery pause.
   - Default sensitive information such as exact DOB, phone, email, birth time/place, and coordinates to private. Show age rather than DOB to other users; do not reveal birth-time/astrology input unless the user explicitly chooses to share it.
   - Enforce visibility in every API serializer and query path, not only by hiding fields in the UI. Make “view as another user” previews available and explain visibility changes.

3. **Explain sensitive data collection**
   - Add brief just-in-time explanations beside DOB, birth time, and birth place: why Tara needs each value, whether it is optional, what feature uses it, who sees it, and how to edit/delete it.
   - Be accurate that birth details support astrology/chart and compatibility features; do not describe stored birth coordinates as live location tracking. Provide a way to use core matching without astrology where product design allows.

4. **Download and delete account**
   - Add authenticated export request/download covering account/profile fields, photos, preferences, matches, swipes, conversations, game responses, notifications, and reports relevant to the user. Use a short-lived, private download URL, verify identity, notify the user, and audit the request.
   - Add self-service deletion with clear consequences, re-authentication, and confirmation. Immediately remove the account from discovery, revoke sessions/tokens, and schedule deletion of database rows, file objects, caches, and derived data.
   - Define limited exceptions for records retained for safety/legal obligations. Keep retained data minimized or pseudonymized, segregated, access-controlled, and tied to a documented expiry; explain the exception to the user.
   - Ensure deleting an account removes uploaded files, including game-photo files, rather than only deleting database references. Specify backup expiry and do not claim immediate deletion from backups unless it is actually implemented.

5. **Retention schedule**
   - Approve explicit time periods for deleted account data, submitted reports, evidence attachments, moderation decisions/appeals, and backups. Set deletion jobs and monitor completion.
   - Preserve only a minimized case record when retention is necessary to prevent repeat abuse or meet a legal obligation; avoid retaining full conversations/photos by default. Provide reviewer-only access and record every view/export.
   - Include user deletion/export in the privacy notice and make the app show request status and completion.

6. **Notification previews**
   - Keep message notification text generic by default; never place message bodies, sensitive game answers, or private photos in push payloads or lock-screen previews.
   - Add a user preference such as “Show sender and message preview / Hide message content / Hide all sensitive notification details,” defaulting to hidden content. Ensure the preference applies to OS push, local notifications, email, and wearable previews if those channels are added.
   - Test notifications while locked and on shared-device surfaces; ensure analytics/crash logs do not capture notification payloads containing private content.

### Acceptance criteria

- Other users and unauthenticated clients cannot retrieve exact latitude/longitude, full DOB, birth time, phone, or email through profile, discovery, match, chat, or notification APIs.
- Users can choose visibility for supported fields and pause discovery; backend responses enforce the same settings.
- Sensitive-field explanations are shown at collection time and match actual backend use.
- A signed-in user can export their data and request deletion, with status, session revocation, file cleanup, and documented safety/legal retention exceptions.
- Deleted-account, report, and moderation-evidence retention periods are approved, implemented, and measurable.
- Notification previews are generic by default and never expose message bodies or game answers on lock screens.

## 10. Block, report, and match controls

### Current implementation found

- `apps.realtime.Match` has a `BLOCKED` status, but there is no user-facing block/unblock endpoint or profile/chat block action found. The model is currently consumed by recommendation filtering and game-night eligibility checks.
- Recommendation generation and recommendation listing filter out blocked pairs in both directions. A block created after a recommendation is queued is filtered from the list, but there is no block action to create the record or explicitly clear queued rows.
- Matched chat and game authorization currently checks that the `matching.Match` remains `MATCHED` and that the user is a participant. It does not check the separate `realtime.Match` block record. Therefore the existing data model alone would not immediately stop messages or game invites.
- There is a game-night-only report endpoint. It accepts a free-text reason, records one report per reporter/session, and closes that game-night room for the reporter. It does not create a general user/content report, block the other person, or cover normal chat and game sessions.
- `matching.Match` has no unmatched or paused state/action. There is no unmatch/pause-connection endpoint or confirmation flow found.

### Product behavior and implementation tasks

1. **Block from profile, chat, and games**
   - Provide a consistent Block action on profile cards, chat headers, message/game menus, and game result/session surfaces. Add an optional reason/report step, but make blocking available without submitting a report.
   - Create one canonical block relationship with actor, blocked user, timestamp, optional report/case link, and active/reversed state. Keep directionality so one user's block is enforced for both users without telling the blocked person who initiated it.
   - In a single transaction, block the pair, stop further messages and game actions/invites, close pending/active game sessions, end or hide the connection, remove queued/daily recommendations in both directions, and revoke or disconnect active chat sockets where possible.
   - Enforce block checks server-side at every entry point: REST and WebSocket chat, message reactions, match detail/history, game create/respond/action, game-night queue/room/message/action/vote, push/notifications, swipe and recommendation generation/listing. A hidden button alone is insufficient.
   - Do not expose the blocker's profile to the blocked user in recommendations or search, or reveal the blocker's identity in error messages/notifications.

2. **Report from any surface**
   - Add Report actions on profiles, chat messages/conversations, and game interactions. Capture target type/ID and relevant context (message/session IDs) with the categories in section 3.
   - Give the reporter an immediate receipt, safety option to block, and ability to leave the chat/game. Never make reporting contingent on blocking.
   - Prevent the reported user from seeing the reporter identity or report details. Keep evidence access restricted and audited.

3. **Unmatch and pause this connection**
   - **Unmatch:** permanently end this connection, hide the match from both inboxes, prevent messages/invites, and remove future recommendations for this pair. Explain that the action cannot be undone from the UI; require confirmation and provide report/block options in the same dialog.
   - **Pause this connection:** temporarily mute/quiet this connection for the acting user (no new message/game notifications; optionally hide it from the top of the inbox) without notifying the other person or implying a safety block. Make it reversible from settings/chat and define whether messages remain available.
   - Store explicit connection state and actor/timestamp. Do not overload swipe `PASS`, `is_visible`, or `is_active` to represent a distinct control.

4. **Confirmation and user feedback**
   - Before unmatch or a permanent block action, name the affected person and explain concrete effects: messages, games, recommendations, chat history, and whether the other person is notified. Use a second confirmation for irreversible unmatch; make report submission itself low-friction.
   - After action, immediately update the UI, remove/disable relevant controls, and provide a clear completion state. Define how accidental blocks/unmatches can be reversed (if supported) without reopening unsafe contact automatically.

5. **Recommendation and identity edge cases**
   - Apply pair exclusions to every recommendation path, including precomputed/daily queues, initial generation, refresh, game-night pairing, and any search/discovery API. Exclude both directions and clear already-created rows when a block becomes active.
   - Ensure account deletion, re-registration, or stale queue jobs cannot resurrect a blocked pair. Decide how block records survive account deletion where needed for anti-abuse, using minimized identifiers and documented retention.

### Acceptance criteria

- A block from any supported surface takes effect immediately: neither person can send messages, start/accept games, join paired game-night sessions, or receive the other in recommendation/discovery results.
- Existing sockets and pending game invitations are closed or rejected, and queued recommendations in both directions are removed or unservable.
- Reporting works for profiles, messages, conversations, and games and attaches the appropriate evidence reference without revealing reporter identity.
- Unmatch ends the connection and cannot be undone by a new swipe or recommendation; pause is reversible and clearly differs from block/unmatch.
- Confirmation copy accurately describes the action, and the UI updates in real time with accessible success/error states.
- Automated coverage verifies REST, WebSocket, recommendation, game, and game-night paths for both sides of a blocked pair.

## 11. Chat and content safety

### Current implementation found

- Text messages are limited to 5,000 characters in the REST serializer. The WebSocket path requires non-empty text but does not apply that serializer's length limit. No repeated-message, send-velocity, link-spam, or abusive-language moderation was found.
- No message-level warning, hide, delete-for-me, or report action was found. The existing game-night report applies to a room, not an individual chat message or shared item.
- Message content is stored as text and returned to both chat participants. Links appear to be plain text; no link reputation, unsafe-link interstitial, preview-safety, or malicious-domain handling was found.
- Photo Scavenger Hunt uploads are limited to 8 MB and checked for an image signature; the completed game's photo view is restricted to the two match participants and returns `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`. General profile photos also have image-content validation. No content moderation or user report hook was found for either photo surface.
- New-message notifications contain sender name and generic text, not the message body. This reduces content leakage but can still reveal who contacted the user.
- The current report model stores a room and free-text reason. It does not preserve a message snapshot, attachment reference, category, review state, or evidence retention/access log. The existing message itself may change or be deleted in future workflows, so it is not a durable report evidence record.

### Product behavior and implementation tasks

1. **Spam and abusive-content controls**
   - Apply one shared server-side message validation path to REST and WebSocket delivery, including consistent length limits, normalization, and safe handling of Unicode/control characters.
   - Add per-account and per-conversation velocity limits, duplicate/repeated-content detection, link-rate limits, and progressive friction. Keep limits configurable and observable; avoid silently dropping legitimate messages.
   - Add language safety detection appropriate to Tara's supported languages. Start with risk scoring and user prompts/warnings for likely harassment, threats, or slurs; reserve message blocking/account restrictions for clear high-confidence cases and provide a review/appeal path.
   - Re-check spam limits for automated game invites, reactions, game messages, and game-night messages, not just ordinary chat text.

2. **Warnings for high-risk requests**
   - Detect common requests for money/transfers, passwords/one-time codes, payment details, government IDs, precise home/work location, or intimate content. Show a brief contextual safety reminder before delivery or when the recipient opens the message.
   - Do not collect or store the actual password/card/OTP content in a separate safety system. Use carefully scoped detection with understandable false-positive behavior; do not claim that Tara can detect every scam.
   - Provide recipient controls (block/report) directly from the warning and never tell the sender which exact detection rule fired.

3. **Links, photos, and shared content**
   - Keep URLs non-clickable or show a clear external-link confirmation for unknown domains; use a maintained reputation service or safe-browsing check where available. Do not fetch arbitrary URLs server-side without SSRF protections and strict egress rules.
   - Prevent executable/active content uploads; verify actual file type, size, dimensions, and decode/re-encode supported images. Strip EXIF metadata (especially GPS) from images before storage/display and serve with safe content headers.
   - Add malware scanning and content moderation for uploads as appropriate, private authorization-checked delivery, upload limits, and a review/removal process. Apply moderation to profile photos, game photos, and any future attachments.
   - Clearly show whether an image/link is private, who can view it, and when game content is revealed to a partner.

4. **Hide and report a message**
   - Let a user hide a message from their own view without deleting it for the other participant or altering source evidence. Make “hide for me” distinct from a sender deleting/unsending a message.
   - Add Report to an individual message, image, link, or game event. Let users include surrounding context; collect only the minimum adjacent messages needed for fair review.
   - After reporting, offer immediate block and hide controls. Do not reveal the report to the other participant.

5. **Evidence preservation and access**
   - On report submission, create an immutable evidence snapshot or stable references to the reported message, sender/recipient, timestamp, attachment hash/object, and limited surrounding context. Preserve original timestamps and relevant moderation signals without exposing evidence to ordinary users.
   - Limit evidence to authorized reviewers, log every view/export/action, encrypt it at rest and in transit, and prevent evidence URLs from being public or guessable.
   - Define a retention timer per report severity and legal/safety hold. Automatically delete evidence when the timer expires, while retaining only a minimized case outcome where justified. User deletion/export workflows must respect those explicit exceptions.
   - Tell the reporter what was captured and the retention approach in concise in-product copy; do not promise evidence is retained indefinitely.

### Acceptance criteria

- REST and WebSocket messages use the same content limits and safety checks; spam bursts and repeated content are slowed or blocked with clear feedback.
- High-risk money/password/sensitive-data requests trigger a proportionate contextual warning without logging secrets or exposing internal rules.
- Links and images have documented safe handling, and uploaded images do not expose embedded GPS metadata.
- A user can hide one message locally and report a specific message/content item with relevant context.
- A report creates restricted, auditable evidence with an explicit expiry; only authorized reviewers can access it, and deleted/expired evidence is actually removed.
- Existing generic message notification behavior remains free of message bodies and private attachments.
## 12. Reporting and moderation operations

### Current implementation found

- The only user report flow found is a game-night room report with free-text reason. It has no category, case status, priority, assignment, user-facing case history, or moderator action workflow.
- The Django admin registers reports for viewing, but there is no dedicated moderation queue, evidence viewer, reviewer assignment, or appeal/reinstatement flow.
- The custom admin portal login accepts email/password and issues JWTs to any active staff user. Portal views use `IsAdminUser`, which checks staff status; no granular moderation roles or stronger authentication/MFA were found in the inspected backend.
- Django's built-in admin has standard change logging, but no application-wide audit model was found for moderator evidence access, case decisions, report access/export, or admin-portal actions. Normal list/detail views are not logged as access events.
- No repeat-offender detection, action reason-code catalog, account restriction history, or reinstatement controls were found.

### Product behavior and implementation tasks

1. **Report intake and reporter updates**
   - Build one report flow reusable from profile, chat, individual content, and games. Require category, target, and confirmation; keep details optional and short, and allow safe exit/blocking without forcing a report.
   - Show immediate receipt with case reference and what happens next. Provide status updates for meaningful state changes (received, under review, action taken/closed) without revealing confidential reviewer notes or another user's private data.
   - Add duplicate-report linking and abuse controls while preserving independent reports/evidence. A report must not be silently discarded because a similar one already exists.

2. **Moderation queue and case record**
   - Create a queue with priority (urgent/standard), status, age/SLA timer, category, reported account, reporter count, assigned reviewer, and escalation marker.
   - Case detail should include report history and relevant evidence only: reported user/content references, limited surrounding context, timestamps, attachment metadata, relevant prior upheld actions, and links to prior related cases. Keep reporters and accused users from seeing each other's identity/details.
   - Support filtering, assignment, internal notes, duplicate/related cases, escalation, and closure reasons. Do not use unrestricted full-account browsing as the default case-review workflow.

3. **Moderator actions and reason codes**
   - Add action controls for warning, temporary restriction, suspension, and permanent ban as defined in section 4. Require a reason code, case link, scope/duration where applicable, evidence reference, and reviewer identity before an action can be committed.
   - Use a versioned reason-code taxonomy (for example: harassment, threats, scam/fraud, impersonation, underage, unsafe content, spam, evasion, other) with separate internal notes for context.
   - Record every action as an append-only event; corrections should be new events with a reason, not silent edits. Reinstatement must explicitly end/override a restriction and record who approved it and why.

4. **Role-based access and stronger admin authentication**
   - Define separate roles such as support (limited account metadata), moderator (case/evidence review and scoped actions), senior moderator (severe actions/appeals), and security administrator (role/configuration management).
   - Enforce least privilege on both Django admin and every custom admin-portal API. Remove blanket `is_staff` access to sensitive reports/conversations; require per-action permissions and periodic access reviews.
   - Require MFA or an identity-provider enforced second factor for all staff/admin access; use short-lived sessions, re-authentication for permanent bans, role changes, and evidence exports, and revoke sessions promptly when access is removed.
   - Protect admin endpoints with rate limits and security monitoring. Do not put long-lived admin credentials or tokens in browser storage beyond the product's approved secure session design.

5. **Repeat-offender detection and appeals**
   - Link prior upheld cases/actions using stable internal account identifiers and privacy-reviewed signals. Distinguish repeated substantiated behavior from duplicate reports, unverified accusations, shared devices/network addresses, and legitimate account recovery.
   - Escalate repeat behavior according to a documented policy; do not automatically issue a permanent ban based solely on raw report volume or an opaque device/network match.
   - Offer a structured appeal with case reference, reason, optional evidence, status updates, and a reviewer independent of the original decision for severe actions where staffing allows.
   - Provide controlled reinstatement, restriction reduction, or appeal denial outcomes. Revoke active tokens and enforce any surviving restriction consistently across REST, WebSocket, discovery, chat, and games.

6. **Audit access and actions**
   - Log moderator sign-ins, failed MFA, case views, evidence views/downloads, searches, exports, assignments, notes, decisions, action changes, appeals, and reinstatements.
   - Audit records should include actor, role, case/user reference, action, timestamp, outcome, and reason where applicable; avoid copying unnecessary message or photo content into audit logs.
   - Make audit events append-only and restrict access to a separate audit/security role. Alert on unusual bulk access, exports, repeated failed access, or self-investigation of a staff member's own account.
   - Set a defined retention period for audit events and report evidence, including any legal hold process, consistent with section 2.

### Acceptance criteria

- Reports from every supported surface create a case with category, priority, optional context, confirmation, and a reporter-visible receipt/status.
- Moderators can triage/assign cases and view only evidence needed for that case; priority queues expose aging and escalation.
- Every warning, restriction, suspension, ban, appeal outcome, and reinstatement requires a reason and produces an immutable audit event.
- Staff roles are enforced server-side across both Django admin and the custom portal; sensitive access requires MFA and is logged.
- Repeat-offender signals support human review and cannot make a permanent decision solely from report count or weak shared-device/network signals.
- Users have an appeal path for verification/moderation outcomes, and reinstatement restores access consistently without leaking reporter identities.
- Security reviewers can reconstruct who viewed evidence and who changed a case/action, with retention expiry applied to both evidence and logs.

## 13. Safer in-person plans

### Current implementation found

- Tara has no date-plan model, trusted-contact sharing, post-date check-in, or meetup safety concern flow in the inspected backend/frontend paths.
- Existing location fields are birth/astrology inputs. No live device-location tracking or location-sharing feature was found. Keep that distinction explicit if date planning is added.

### Product behavior and implementation tasks

1. **Optional date plan in chat**
   - Let matched users optionally create/share a plan containing an activity, scheduled date/time with timezone, and a public venue (name/address or map place reference). Keep plan creation separate from ordinary chat and never create one automatically.
   - Show who can see the plan, allow edits/cancellation, and use a clear confirmation before sharing it with the match. Avoid collecting home addresses or suggesting private locations as the default.
   - Keep the plan private to the two participants unless the user explicitly shares it with a trusted contact. Exclude it from profile/discovery/admin analytics unless needed for support or a reported safety incident.

2. **Trusted-contact sharing**
   - Provide a one-time share action that lets a user choose what to send (venue, activity, date/time, match display name, and Tara's safety guidance) and which trusted contact receives it.
   - Prefer the device's native share sheet so Tara does not need to upload address books or store trusted contacts. If Tara stores a contact or sends the message directly, obtain explicit consent, verify the destination, explain exactly what is shared, and provide delete/revoke controls.
   - Do not silently share a user's plan, match identity, phone number, or location. Clearly confirm success/failure without exposing contact details to the match.

3. **Post-date check-in and concern reporting**
   - Let users opt into a reminder at a chosen time, with choices such as “I’m okay,” “I need support,” or “I didn’t meet up.” Make reminders easy to dismiss, snooze, or disable.
   - Allow a safety concern report from the plan/check-in flow, linking it to the match and any relevant chat/report case while reusing the report categories and moderation process from sections 3 and 12.
   - Explain that Tara's check-in is not emergency monitoring and may not be read in real time. Offer locally appropriate emergency guidance without promising dispatch or live intervention.
   - Do not infer consent or danger from a missed check-in. A missed response must not automatically contact a trusted person or disclose additional data unless the user explicitly configured and confirmed that behavior.

4. **Opt-in, location, and lifecycle safeguards**
   - Keep plan creation, trusted-contact sharing, and check-ins optional; use plain consent screens and separate permissions for each feature.
   - Do not request background or continuous location permission for these features. Use user-entered public venue details or a one-time place selection; never add live tracking by default.
   - Define retention: allow plan deletion/cancellation, automatically expire old plans and check-in metadata after a short published period, and retain plan evidence longer only when linked to a safety case under a documented hold.
   - Use private, access-controlled APIs and notifications. Lock-screen messages should not disclose venue/time unless the user opted into that level of detail.

### Acceptance criteria

- Users can create, edit, cancel, or delete an optional plan in chat with activity, time/timezone, and a public venue; it is shared only with intended recipients.
- Trusted-contact sharing is an explicit user action with a preview of exactly what will be sent; no address-book upload or background sharing occurs by default.
- Users can opt into a post-date reminder, snooze/disable it, and submit a linked safety concern; a missed check-in alone does not trigger an undisclosed escalation.
- The feature requests no background/live location permission and does not expose exact device coordinates.
- Plan/check-in records have defined expiry, and any safety hold is explicit, restricted, and audited.
- User-facing copy accurately states that Tara is not an emergency-response service and clarifies whether anyone is actively monitoring a check-in.

## 14. Security and launch readiness

### Current implementation found

- DRF defaults to JWT authentication and `IsAuthenticated`; signup/login and selected lookup/admin-login endpoints explicitly allow anonymous access. Chat APIs check match membership/status, game endpoints check session/match participation, and profile-photo deletion is scoped to the requesting user. Existing access-control tests cover several of these cases.
- Admin access is broader: custom portal APIs use `IsAdminUser`/staff status, and no role-specific moderator permissions or MFA were found. Section 12 defines the remediation requirements.
- Photo Scavenger Hunt reveal is participant-gated and sends private/no-store plus `nosniff` headers. In contrast, `MEDIA_URL` is served by Django when `SERVE_MEDIA` is true, and that setting defaults to true. Profile-photo URLs can therefore bypass API authorization unless production infrastructure separately protects media.
- No DRF throttling configuration or endpoint-level throttles were found. Signup, messaging, reports, and verification are not protected by application rate limits in the inspected code.
- `settings.py` has development fallbacks (`unsafe-dev-key`, a default database password) and does not define HTTPS/HSTS/secure-cookie policy. Whether TLS, encryption at rest, secret management, and network controls are supplied by production infrastructure is unknown and must be verified.
- No custom Django `LOGGING` configuration was found. The astrology views log raw birth-place search values and exact coordinates in exception messages. Remove or redact these values before production; exception traces and third-party request logs also need review.
- Existing tests cover several authentication/ownership boundaries, chat participant authorization, game privacy, and game-night reporting. No cross-surface block/report matrix or account deletion/export verification exists yet. Tests were inspected, not run as part of this documentation update.
- No safety metrics dashboard or incident-response runbook was found in the reviewed repository.

### Launch-readiness tasks

1. **Authorization review**
   - Build an endpoint inventory covering profile, discovery, match, chat (REST/WebSocket), games, photos/media, reports, admin portal, and Django admin. For each route record authentication, object-level authorization, sensitive fields returned, and expected 401/403/404 behavior.
   - Verify users can access only their own profile/settings/photos/reports/export; only match participants can access that match's chat/game content; and only explicitly authorized staff roles can access reports, evidence, or admin operations.
   - Treat media URLs as APIs: require authenticated/authorized delivery or short-lived signed access, and check ownership/relationship/report state before returning files. Disable Django's public media serving in production.
   - Review websocket connect, reconnect, group membership, and every event handler for authorization after connection; revoke active access when match/block/account status changes.

2. **Data, transport, and secret protection**
   - Require non-default production secrets from a secret manager; fail startup when the development secret/database password is used in production. Rotate any credentials exposed in source, logs, or local environment files.
   - Verify TLS for browser/mobile/API/WebSocket traffic and secure proxy configuration. Set production HTTPS redirect, HSTS, secure/HTTP-only/SameSite cookie policy where applicable, trusted proxy handling, and restrictive CORS/CSRF origins.
   - Confirm database, media, backups, cache/channel layer, and report evidence encryption/access controls at rest; document key ownership, rotation, environment separation, and restoration access.
   - Remove PII from log messages (including birth place and precise coordinates), never log passwords/OTP/JWTs/message bodies/photo URLs, and configure redaction, access controls, and retention for app/proxy/provider logs.
   - Run production deployment checks and dependency/security scanning; resolve high-severity findings before launch and document accepted residual risk.

3. **Rate limits and abuse resilience**
   - Add distributed/server-side limits to signup, OTP send/verify, login/reset, messaging (REST and WebSocket), reports, profile/photo uploads, game invitations/actions, and admin login/evidence export.
   - Use per-account plus carefully minimized network/device controls, `Retry-After` responses, and monitoring. Avoid lockout rules that enable attackers to deny service to a targeted user.
   - Test the limits across multiple app workers so an in-memory throttle cannot be bypassed by scaling horizontally.

4. **Safety regression matrix**
   - Test both directions of block across recommendation queues, daily recommendations, chat REST/WebSocket, notifications, game invite/accept/action, game-night pairing, profile/media access, and stale sessions.
   - Test report submission from profile/message/photo/game, evidence snapshot accuracy, reporter confidentiality, moderation-role access, action audit, appeals, and retention expiry.
   - Test deletion/export for related database rows, uploaded files, cache/index copies, JWT/session revocation, report/legal holds, and backup expiry assertions.
   - Include unauthorized and cross-account cases, race conditions (e.g. block while sending/accepting a game), duplicate requests, failure recovery, and accessibility/user-visible error states.

5. **Safety metrics and operational alerts**
   - Track report volume by category/priority, time to first review and resolution, SLA misses, repeat substantiated reports, actions by type, appeal volume/outcomes, reinstatements, and measured false-positive reversals.
   - Define event semantics and denominator/time windows before interpreting rates. Use aggregated or pseudonymous reporting; do not put message text, photos, or precise location into analytics.
   - Alert on urgent-case queue age, growing backlog, access anomalies, repeated account abuse, evidence exports, and report/appeal processing failures. Restrict metric access and define retention.

6. **Incident response**
   - Create an on-call/runbook for urgent user-safety reports and suspected data exposure, including severity levels, accountable incident lead, moderator/security/legal/privacy contacts, escalation channels, evidence preservation, and decision logging.
   - For data exposure, include containment, token/key rotation, affected-data and user impact assessment, safe restoration, required user/regulator notifications based on applicable rules, and a post-incident review.
   - For urgent user safety, include immediate protective product actions, reviewer escalation, regional emergency guidance, child-safety handling, and clear boundaries about whether the queue is staffed/monitored.
   - Practice tabletop scenarios before launch and after material changes; record owners, contact coverage, and follow-up actions.

### Release gates

- No production launch until insecure development secret/password fallbacks are rejected, media access is verified private where required, and PII is removed from logs.
- Authorization review passes for profile, chat, photos, reports, games, recommendations, and admin surfaces, including WebSocket and cross-account cases.
- Rate limits operate across all app workers and report/game/message abuse controls have usable failure feedback.
- Block/report regression tests pass across chat, recommendations, notifications, and games; account deletion verification covers media and explicit retained-record exceptions.
- Safety metrics, alert ownership, moderation/on-call coverage, and incident response contacts are assigned and exercised.
