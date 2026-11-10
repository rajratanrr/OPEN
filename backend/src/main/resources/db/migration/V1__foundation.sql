CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE organizations (
 id uuid PRIMARY KEY, name varchar(160) NOT NULL, type varchar(40) NOT NULL DEFAULT 'MUNICIPAL',
 jurisdiction geometry(Polygon,4326) NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX organizations_area_idx ON organizations USING gist(jurisdiction);
CREATE TABLE users (
 id uuid PRIMARY KEY, name varchar(100) NOT NULL, email varchar(254) NOT NULL UNIQUE,
 password_hash varchar(100) NOT NULL, role varchar(30) NOT NULL CHECK (role IN ('CITIZEN','MUNICIPAL_OFFICER','SUPER_ADMIN')),
 organization_id uuid REFERENCES organizations(id), public_display_name varchar(100) NOT NULL,
 leaderboard_opt_in boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true,
 notifications_enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE refresh_sessions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash varchar(64) UNIQUE NOT NULL, expires_at timestamptz NOT NULL, revoked boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_user_idx ON refresh_sessions(user_id);
CREATE TABLE password_resets (
 token_hash varchar(64) PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, used boolean NOT NULL DEFAULT false
);
CREATE TABLE evidence (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), storage_key varchar(120) NOT NULL UNIQUE,
 content_type varchar(80) NOT NULL, image_size integer NOT NULL CHECK(image_size>0), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ai_analyses (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), evidence_id uuid NOT NULL REFERENCES evidence(id),
 model_name varchar(100), result jsonb, analysis_status varchar(30) NOT NULL,
 input_tokens integer, output_tokens integer, latency_ms integer, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE reports (
 id uuid PRIMARY KEY, reporter_id uuid NOT NULL REFERENCES users(id), organization_id uuid NOT NULL REFERENCES organizations(id),
 client_request_id uuid NOT NULL, description varchar(3000) NOT NULL, road_name varchar(180) NOT NULL,
 latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90), longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 location geography(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude,latitude),4326)::geography) STORED,
 gps_accuracy_meters double precision CHECK(gps_accuracy_meters BETWEEN 0 AND 5000),
 damage_type varchar(30) NOT NULL CHECK(damage_type IN ('POTHOLE','CRACK','SURFACE_DAMAGE','WATERLOGGING','OTHER_HAZARD','NO_VISIBLE_DAMAGE','UNCERTAIN')),
 severity varchar(20) NOT NULL CHECK(severity IN ('LOW','MEDIUM','HIGH','CRITICAL','UNKNOWN')),
 status varchar(25) NOT NULL CHECK(status IN ('PENDING_REVIEW','VERIFIED','ASSIGNED','IN_PROGRESS','RESOLVED','REJECTED')),
 evidence_id uuid NOT NULL REFERENCES evidence(id), ai_analysis_id uuid REFERENCES ai_analyses(id),
 assigned_to uuid REFERENCES users(id), priority varchar(15), due_date date,
 is_demo boolean NOT NULL DEFAULT false, version bigint NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz,
 UNIQUE(reporter_id,client_request_id)
);
CREATE INDEX reports_location_idx ON reports USING gist(location);
CREATE INDEX reports_status_date_idx ON reports(status,created_at DESC);
CREATE INDEX reports_org_status_idx ON reports(organization_id,status);
CREATE INDEX reports_reporter_idx ON reports(reporter_id,created_at DESC);
CREATE TABLE report_status_history (
 id uuid PRIMARY KEY, report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
 previous_status varchar(25), new_status varchar(25) NOT NULL, changed_by uuid NOT NULL REFERENCES users(id),
 reason varchar(1500), changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX report_history_idx ON report_status_history(report_id,changed_at);
CREATE TABLE report_confirmations (
 report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(report_id,user_id)
);
CREATE TABLE repair_evidence (
 id uuid PRIMARY KEY, report_id uuid NOT NULL REFERENCES reports(id), evidence_id uuid NOT NULL REFERENCES evidence(id),
 uploaded_by uuid NOT NULL REFERENCES users(id), notes varchar(1500), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE internal_notes (
 id uuid PRIMARY KEY, report_id uuid NOT NULL REFERENCES reports(id), author_id uuid NOT NULL REFERENCES users(id),
 note varchar(1500) NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE notifications (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), type varchar(40) NOT NULL,
 title varchar(150) NOT NULL, message varchar(1500) NOT NULL, related_report_id uuid REFERENCES reports(id),
 is_read boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications(user_id,created_at DESC);
CREATE TABLE point_transactions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), report_id uuid NOT NULL REFERENCES reports(id),
 points integer NOT NULL, reason varchar(40) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,report_id,reason)
);
CREATE INDEX points_user_idx ON point_transactions(user_id);
CREATE TABLE monitoring_sessions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), started_at timestamptz NOT NULL DEFAULT now(),
 ended_at timestamptz, status varchar(12) NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','STOPPED'))
);
CREATE UNIQUE INDEX one_active_session_idx ON monitoring_sessions(user_id) WHERE status='ACTIVE';
CREATE TABLE sensor_events (
 id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES monitoring_sessions(id) ON DELETE CASCADE,
 latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90), longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 recorded_at timestamptz NOT NULL, acceleration_magnitude double precision NOT NULL CHECK(acceleration_magnitude BETWEEN 0 AND 200),
 jerk double precision NOT NULL CHECK(jerk BETWEEN 0 AND 2000), estimated_speed double precision NOT NULL CHECK(estimated_speed BETWEEN 1.5 AND 60),
 gps_accuracy double precision NOT NULL CHECK(gps_accuracy BETWEEN 0 AND 50), verification_status varchar(20) NOT NULL DEFAULT 'UNVERIFIED',
 UNIQUE(session_id,recorded_at)
);
CREATE INDEX sensor_session_idx ON sensor_events(session_id,recorded_at);
CREATE TABLE audit_logs (
 id uuid PRIMARY KEY, actor_id uuid REFERENCES users(id), action varchar(70) NOT NULL, entity_type varchar(40) NOT NULL,
 entity_id uuid, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE system_settings (
 key varchar(80) PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO system_settings(key,value) VALUES ('detection','{"duplicateRadiusMeters":20,"alertRadiusMeters":150,"bumpThreshold":8}');
