# API reference

The gateway exposes `/api/v1`. Browser authentication uses HttpOnly cookies. Mutating requests require `X-Roadsaathi: 1`; browser origins must match the server allowlist. JSON requests need `Content-Type: application/json`. Use `credentials: 'include'`. No bearer token is stored in browser local storage.

Interactive OpenAPI documentation is at `http://localhost:8088/swagger-ui.html` in Docker, or `http://127.0.0.1:8080/swagger-ui.html` in the native installation. `/v3/api-docs` provides the generated schema. Gateway telemetry routes are documented below because they are implemented in Express.

## Authentication and profile

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/register` | Register a citizen; name, email, password |
| POST | `/auth/login` | Issue an access cookie and rotating refresh cookie |
| POST | `/auth/refresh` | Rotate the refresh session |
| POST | `/auth/logout` | Revoke the refresh session and clear cookies |
| GET | `/auth/me` | Current authenticated profile |
| POST | `/auth/forgot-password` | Send a reset email when SMTP is configured |
| POST | `/auth/reset-password` | Consume a valid one-time reset token |
| GET / PATCH / DELETE | `/users/me` | Read, update or anonymize/deactivate the current account |
| POST | `/users/me/password` | Change password and revoke all sessions |
| GET | `/users/me/stats` | The citizen's real report counts and point balance |
| GET | `/users/me/reports` | Paginated reports belonging to the current account |

## Reports and evidence

| Method | Path | Access |
| --- | --- | --- |
| POST | `/evidence` | Authenticated multipart `image`; JPEG/PNG, at most 8 MB / 20 MP |
| GET | `/evidence/{id}` | Public if attached to a non-rejected report; otherwise owner/scoped staff |
| POST | `/reports` | Signed-in citizen or staff; always starts pending review |
| GET | `/reports` | Public, with filters and pagination |
| GET | `/reports/map` | Public, bounded map query |
| GET | `/reports/nearby` | Public, meter-based radius query |
| GET | `/reports/{id}` | Public except rejected/private fields |
| PATCH | `/reports/{id}` | Reporter, only while pending review |
| GET | `/reports/{id}/history` | Same visibility as report |
| POST / DELETE | `/reports/{id}/confirm` | Independent authenticated citizen confirmation |
| POST | `/ai/analyze-road-image` | Owner of uploaded evidence, with explicit consent |
| GET | `/ai/analyses/{id}` | Analysis owner |

Report creation shape:

```json
{
  "clientRequestId": "client-generated-uuid",
  "roadName": "Road or landmark",
  "description": "At least ten characters of observed detail.",
  "latitude": 30.901,
  "longitude": 75.8573,
  "gpsAccuracyMeters": null,
  "damageType": "POTHOLE",
  "severity": "UNKNOWN",
  "evidenceId": "owned-evidence-uuid",
  "aiAnalysisId": null
}
```

The example coordinates are illustrative, not device GPS. A report location must lie in a configured jurisdiction. Reusing a `clientRequestId` for the same reporter returns the existing report instead of creating a second one.

List filters: `q`, `status`, `severity`, `damageType`, `verifiedOnly`, `unresolved`, `days`, `from`, `south`, `north`, `west`, `east`, `latitude`, `longitude`, `radius`, `sort`, `page`, `pageSize`. Pages are zero-based; page size is capped at 200; nearby radius is capped at 50 km. `verifiedOnly=true` returns verified/assigned/in-progress hazards and excludes resolved reports. Returned lists contain `items`, `total`, `page` and `pageSize`.

## Municipal and administrative operations

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/municipal/reports` and `/municipal/reports/pending` | Jurisdiction-scoped work queues |
| GET | `/municipal/officers` | Assignable officers |
| POST | `/municipal/reports/{id}/verify` | Human verification |
| POST | `/municipal/reports/{id}/reject` | Rejection with reason |
| POST | `/municipal/reports/{id}/assign` | Officer, priority and target date |
| PATCH | `/municipal/reports/{id}/status` | Validated lifecycle transition |
| POST | `/municipal/reports/{id}/repair-evidence` | Owned evidence ID and optional notes |
| POST | `/municipal/reports/{id}/notes` | Internal city-staff note |
| GET | `/analytics/public-summary` | Public database counts |
| GET | `/analytics/municipal-summary` | Scoped totals, trends and category distributions |
| GET | `/analytics/resolution-performance` | Recorded resolution by road |
| GET | `/analytics/hazard-hotspots` | Scoped coordinate-cell concentrations |
| GET | `/admin/users` | Administrator user list |
| PATCH | `/admin/users/{id}/role` | Role, jurisdiction and active state; revokes user sessions |
| GET / POST | `/admin/organizations` | List/create service boundaries |
| GET | `/admin/audit-logs` and `/admin/system-health` | Administrative visibility |
| GET / PUT | `/admin/settings` | Detection parameters |

Lifecycle bodies use `status`, `reason`, `assignedTo`, `priority`, `dueDate` and optionally reviewed `severity` / `damageType`. Evidence or a documented reason is required for resolution. Rejection, reopening and category/severity overrides require a reason.

## Community and monitoring

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/notifications` | Current user's notifications |
| PATCH | `/notifications/{id}/read` and `/notifications/read-all` | Mark only owned notifications read |
| GET | `/rewards/me` and `/rewards/history` | Current user's contribution balance and ledger |
| GET | `/rewards/leaderboard` | Opted-in public display names and balances |
| POST / GET | `/monitoring/sessions` | Start or list own foreground journeys |
| GET | `/monitoring/sessions/{id}` | Own session and unverified events |
| PATCH | `/monitoring/sessions/{id}/stop` | Stop own session |
| POST | `/monitoring/sessions/{id}/events` | At most 100 validated, idempotent candidate events |
| GET | `/hazards/nearby` | Active verified hazards near supplied coordinates |
| GET | `/hazards/stream` | Public SSE invalidation events; no private journey payload |
| POST | `/telemetry/samples` | Express: up to 100 raw samples for an owned session |
| GET | `/telemetry/sessions/{id}` | Express: at most 300 recent own samples |
| DELETE | `/telemetry/me` | Express: delete own raw MongoDB samples |
| GET | `/telemetry/health` | Authenticated MongoDB availability check |

Raw sample body:

```json
{
  "sessionId": "owned-session-uuid",
  "samples": [{
    "id": "sample-uuid",
    "recordedAt": "ISO-8601 time during this session",
    "magnitude": 12.3,
    "jerk": 20,
    "latitude": 30.901,
    "longitude": 75.8573,
    "speed": 8,
    "accuracy": 12
  }]
}
```

These are documentation examples, not actual sensor readings. Coordinates/speed/accuracy must come from device APIs. No user ID is accepted in the payload. Events older than seven days, future events, invalid coordinates, oversized batches and cross-account session access are rejected.
