import { Link } from "react-router-dom";
import { Logo } from "../components/ui";
export default function Info({
  kind,
}: {
  kind: "privacy" | "terms" | "about";
}) {
  const title = {
    privacy: "Your trust matters.",
    terms: "A little care goes a long way.",
    about: "A companion for every road.",
  }[kind];
  return (
    <div className="info-page">
      <header>
        <Logo />
        <Link to="/dashboard" className="button secondary">
          Open workspace ↗
        </Link>
      </header>
      <main>
        <span className="eyebrow">ROADSAATHI AI · {kind.toUpperCase()}</span>
        <h1>{title}</h1>
        {kind === "privacy" ? (
          <>
            <h2>What this application stores</h2>
            <p>
              Your account name, email, hashed password, report photographs,
              selected report locations, status history, and contribution points
              are stored by the backend. Reports and normalized evidence are
              public; email addresses and private journey data are not.
            </p>
            <h2>Photographs and AI consent</h2>
            <p>
              Uploaded images are decoded, resized, and re-encoded to strip
              embedded metadata. This does not blur faces or number plates:
              leave personal details out of your photograph. When you explicitly
              consent and AI is configured, a copy is sent to OpenAI for
              preliminary analysis. AI is currently optional; manual reporting
              continues without it.
            </p>
            <h2>Journey monitoring</h2>
            <p>
              Location and motion are collected only after you start monitoring
              and grant permissions. Monitoring stops when the app becomes
              hidden. Raw MongoDB telemetry expires after seven days; the
              backend deletes suspected sensor events after seven days and empty
              session records after thirty days. Public reports persist as civic
              records.
            </p>
            <h2>Offline storage</h2>
            <p>
              Unsent reports, images, and sensor batches remain in IndexedDB on
              your device until successfully synced or explicitly deleted. Clear
              your outbox before sharing the device. Session tokens use HttpOnly
              cookies and are never stored in browser JavaScript storage.
            </p>
            <h2>Your controls</h2>
            <p>
              Settings let you opt out of the leaderboard, turn off future
              notifications, delete raw telemetry, or deactivate and anonymize
              your account. Account deletion retains anonymized public civic
              reports and audit history.
            </p>
          </>
        ) : kind === "terms" ? (
          <>
            <h2>Use the platform responsibly</h2>
            <p>
              Submit accurate, relevant observations. Do not include another
              person’s private information, abusive content, or unrelated
              images. Officers must use only the jurisdiction and permissions
              assigned to them.
            </p>
            <h2>Safety first</h2>
            <p>
              Operate the app while safely parked or as a passenger. Do not stop
              in traffic to photograph a road hazard. This application is not an
              emergency service, navigation system, or guarantee of road safety.
            </p>
            <h2>Uncertainty is part of the record</h2>
            <p>
              Community reports, preliminary AI assessments, and sensor events
              may be incomplete or wrong. Human verification is required.
              Proximity alerts use straight-line distances and do not confirm
              that a hazard is on your road segment.
            </p>
            <h2>Demonstration data</h2>
            <p>
              Records labeled Demo are synthetic examples. They do not represent
              actual verified municipal activity. This development installation
              is not an official government service.
            </p>
          </>
        ) : (
          <>
            <h2>Smarter Roads. Safer Journeys.</h2>
            <p>
              RoadSaathi connects citizens and city teams around a shared record
              of road damage: detect, analyze, verify, assign, repair, and
              confirm. The first service area is Ludhiana, Punjab.
            </p>
            <h2>Built to follow through</h2>
            <p>
              Every submitted report receives a persistent ID. Photographs,
              confirmations, municipal decisions, and repair evidence stay
              connected to the same timeline. City teams work within their
              configured jurisdictions.
            </p>
            <h2>What makes this build different</h2>
            <p>
              A React application connects to a secured Spring Boot backend and
              PostgreSQL/PostGIS database. Express provides the web gateway and
              MongoDB stores optional motion telemetry. AI image analysis stays
              on the server and can be connected later.
            </p>
            <h2>Contact and support</h2>
            <p>
              This local installation has no public support mailbox configured.
              Contact the person or organization operating your instance for
              account recovery and data requests. A public launch needs a
              published operator contact and reviewed municipal boundaries.
            </p>
          </>
        )}
        <Link className="button primary" to="/">
          Back to RoadSaathi
        </Link>
      </main>
    </div>
  );
}
