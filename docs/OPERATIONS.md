# Security and operations

## Local development

The prepared native installation runs the UI on 5173, gateway on 3000, API on 8080, PostgreSQL/PostGIS on 55432 and MongoDB on 57017. The normal launcher binds to this Mac. `Start Phone Test.command` exposes only the frontend on Wi-Fi, adds its exact browser and packaged-app origins, and uses local HTTP cookies for the debug APK. Databases, gateway and API remain on loopback. Keep the Mac awake and use a trusted Wi-Fi network. Development credentials and synthetic seed data must not be used for a public installation.

`DEMO_SEED=true` is accepted only when the `dev` Spring profile is active. It inserts the labeled dataset once. Turning seeding off does not delete existing seed data: start production with a fresh database and evidence store. The sample rectangle is for a Ludhiana demonstration and is not an authoritative municipal boundary.

## Before public deployment

Configure a real HTTPS domain and reverse proxy, `COOKIE_SECURE=true`, exact `ALLOWED_ORIGINS`, `FRONTEND_URL`, `SPRING_PROFILES_ACTIVE=prod` and `DEMO_SEED=false`. Keep databases and the direct API on private networks. Add edge rate limits and request-size limits. The in-process authentication/AI limiter protects one instance; it is not a distributed abuse-prevention system. PostgreSQL is authoritative, so scaling APIs requires shared evidence storage and a shared event bus or continued polling.

To provision the first administrator in an empty production database, set `BOOTSTRAP_ADMIN_EMAIL` and a unique `BOOTSTRAP_ADMIN_PASSWORD` of 14–72 characters. The bootstrap creates an administrator only when no active administrator exists; it never silently promotes an existing citizen. Remove these variables after provisioning. Create reviewed jurisdiction boundaries, then invite/register officers as citizens and assign officer roles through the admin UI. Registration never grants a privileged role.

Set the operator's actual support contact and review the included privacy/terms copy for the deployment. No real municipality has been connected or authorized by this build.

## Authentication and permissions

- BCrypt cost 12; password length checked by UTF-8 bytes to avoid BCrypt truncation.
- Signed 15-minute access cookies; random 30-day refresh values stored only as SHA-256 hashes.
- Refresh rotation uses a row lock. Logout, password changes and role changes revoke sessions.
- Access requests check the persisted session and active user's current role, not a role supplied by the client.
- HttpOnly, SameSite=Strict cookies. Secure is enabled by default and explicitly disabled only for local HTTP development.
- State-changing requests require a custom header and an exact allowed browser origin; CORS never uses a wildcard with credentials.
- Municipal queries and assignments enforce jurisdiction server-side. Internal notes and private monitoring records have separate authorization checks.
- Parameterized queries and bounded filters. Multipart content is decoded, normalized, resized and rewritten with an opaque UUID storage key.
- Images are not executable uploads; private/unattached evidence is not public. Public report content should never contain faces, number plates or personal information.

## Storage and retention

Local evidence uses a persistent mounted volume. S3 mode supports a private S3-compatible bucket with path-style access through the backend. Configure an existing service using `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY` and `STORAGE_SECRET_KEY`; Compose does not provision a bucket or S3 server. The adapter defaults to `us-east-1`; adapt the region setting for a deployment that requires another region. S3 operations were not executed during this build.

MongoDB raw telemetry has a seven-day TTL; deletion may lag until MongoDB's TTL sweep. PostgreSQL sensor candidates older than seven days are removed hourly. Sensor timestamps remain bounded to the session with 30 seconds of clock tolerance, and cannot be more than 30 seconds into the future. Empty stopped session records are retained for up to thirty days. Unsent report drafts remain on the user's device until successful synchronization or explicit deletion. Account deletion anonymizes the profile and removes private PostgreSQL monitoring data; the UI deletes Mongo telemetry before final account deletion. Public civic reports and audit records remain.

Set backup and evidence retention policies appropriate to the operator. For PostgreSQL, use `pg_dump` and test restoration with PostGIS installed. Back up evidence and database records consistently. Mongo raw telemetry is intentionally transient. Unattached uploads need an operator cleanup policy before public scale.

## Monitoring and failure behavior

`/actuator/health` checks the primary database. `/health` checks Express liveness. Authenticated `/api/v1/telemetry/health` checks MongoDB. Password reset is explicitly unavailable when mail is disabled; unavailable AI returns a manual fallback. The gateway's inability to store telemetry does not prevent Spring reporting operations. Failed offline uploads remain in IndexedDB.

SSE carries report invalidations after transactions commit and sends heartbeats; the frontend also refetches every minute. Reverse proxies must disable buffering for the SSE route and allow a long read timeout. The provided Nginx configuration does this.

The system is a functional development build, not a completed independent security audit or capacity test. Production hosting, SMTP, backup restoration, S3, load behavior, multi-instance event delivery and physical Android sensors remain deployment validation tasks.
