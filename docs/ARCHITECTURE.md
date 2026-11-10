# Architecture and data model

The Spring Boot service is the authority for identity and civic workflows. The Express service checks Spring sessions before accepting telemetry and never assigns client-supplied user IDs. PostgreSQL transactions tie report mutations to timelines, points, notifications and audit events. SSE is emitted after commit; the UI also polls every minute.

```mermaid
flowchart LR
    Citizen[Citizen browser or Android app] --> Web[React app and IndexedDB outbox]
    Staff[Municipal officer or administrator] --> Web
    Sensors[Android accelerometer and foreground GPS] --> Web
    Web --> Edge[Nginx or Vite proxy]
    Edge --> Gateway[Express gateway]
    Gateway --> Core[Spring Boot API]
    Gateway --> Mongo[(MongoDB private motion samples)]
    Core --> PG[(PostgreSQL and PostGIS)]
    Core --> Images[Private local or S3 evidence storage]
    Core -. consent and configured key .-> AI[OpenAI Responses API]
    Core -. optional reset email .-> Mail[SMTP provider]
    Core --> Events[SSE after transaction commit]
    Events --> Web
```

## Core ER diagram

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ USERS : scopes_officers
    ORGANIZATIONS ||--o{ REPORTS : receives
    USERS ||--o{ REPORTS : submits
    USERS ||--o{ EVIDENCE : uploads
    USERS ||--o{ REFRESH_SESSIONS : authenticates
    USERS ||--o{ PASSWORD_RESETS : requests
    USERS ||--o{ MONITORING_SESSIONS : owns
    MONITORING_SESSIONS ||--o{ SENSOR_EVENTS : records
    EVIDENCE ||--o{ AI_ANALYSES : assessed
    AI_ANALYSES o|--o{ REPORTS : supports
    EVIDENCE ||--o{ REPORTS : documents
    REPORTS ||--o{ REPORT_STATUS_HISTORY : tracks
    REPORTS ||--o{ REPORT_CONFIRMATIONS : corroborates
    USERS ||--o{ REPORT_CONFIRMATIONS : confirms
    REPORTS ||--o{ REPAIR_EVIDENCE : completion_proof
    EVIDENCE ||--o{ REPAIR_EVIDENCE : supplies
    REPORTS ||--o{ INTERNAL_NOTES : staff_notes
    REPORTS ||--o{ NOTIFICATIONS : updates
    USERS ||--o{ NOTIFICATIONS : receives
    REPORTS ||--o{ POINT_TRANSACTIONS : credits
    USERS ||--o{ POINT_TRANSACTIONS : earns
    USERS ||--o{ AUDIT_LOGS : acts
```

The executable schema is `backend/src/main/resources/db/migration/V1__foundation.sql`. It includes foreign keys, enum constraints, indexed geography, one active monitoring session per user, unique report request IDs, unique confirmations and unique point-award reasons.

MongoDB's `motion_samples` documents contain a server-derived user ID, session ID, sample ID, acceleration, jerk, coordinates, speed, GPS accuracy, recorded time and expiry time. A compound unique index makes ingestion idempotent; a TTL index removes samples after seven days. Session ownership and time bounds are checked through Spring before writes. MongoDB is not a store for authentication secrets or report statuses.

## Repair lifecycle

```mermaid
stateDiagram-v2
    [*] --> PENDING_REVIEW: Citizen submits evidence
    PENDING_REVIEW --> VERIFIED: Officer reviews
    PENDING_REVIEW --> REJECTED: Officer records reason
    VERIFIED --> REJECTED: Officer records reason
    VERIFIED --> ASSIGNED: Officer, priority and due date
    ASSIGNED --> ASSIGNED: Reassignment
    ASSIGNED --> IN_PROGRESS: Repair begins
    IN_PROGRESS --> RESOLVED: Photo or documented completion reason
    RESOLVED --> VERIFIED: Reopen with reason
```

Public lists exclude rejected reports. Rejected details remain readable by the reporter and authorized city staff. Internal notes never appear in citizen responses. Officers may only manage reports in their assigned jurisdiction. Administrators have platform-wide access.

## Offline behavior

The production service worker caches the app shell and immutable assets, not authenticated API responses or external map tiles. IndexedDB stores unsent image blobs and report inputs under their owner ID. A retry checks the active server account, persists the uploaded evidence ID, submits the stable client request ID, and only removes a draft after server confirmation. Reconnection triggers foreground sync; the outbox also provides a manual retry button. Browser background sync is not relied on.

Sensor candidates and raw samples use a separate owner-scoped queue. GPS must be fresh and accurate for candidate creation. No coordinates are fabricated when location is absent. Candidate events remain `UNVERIFIED` and do not become public potholes automatically.

## Deliberate boundaries

- PostGIS handles real meter-based `ST_DWithin` queries and jurisdiction containment. Coordinates are validated and indexed.
- Duplicate suggestions are nearby unresolved reports of the same type; a human chooses whether to confirm an existing report.
- Hotspots are approximately 100 m coordinate-cell aggregations, not a traffic-risk prediction.
- Proximity alerts use straight-line distance and a cooldown. They do not claim the driver is on the same road segment.
- Prioritization text uses stored severity, age and confirmations. It does not invent traffic volume or accident history.
- AI is advisory. Officers remain responsible for verification and repair decisions.
