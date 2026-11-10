import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Filter, MapPin, Plus, Search, SlidersHorizontal } from "lucide-react";
import { HazardMap } from "../components/HazardMap";
import type { Bounds } from "../components/HazardMap";
import {
  Badge,
  Empty,
  ErrorState,
  PageHeading,
  Spinner,
} from "../components/ui";
import { api, queryString } from "../lib/api";
import type { Page, RoadReport } from "../types";
import { imageUrl, label, severities, statuses, damages } from "../types";
export default function MapPage() {
  const [bounds, setBounds] = useState<Bounds>({
    south: 30.8,
    north: 31,
    west: 75.75,
    east: 76,
  });
  const [severity, setSeverity] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [verified, setVerified] = useState(false);
  const [search, setSearch] = useState("");
  const [days, setDays] = useState("");
  const [focus, setFocus] = useState<[number, number]>();
  const onBounds = useCallback((b: Bounds) => setBounds(b), []);
  const query = useQuery({
    queryKey: ["map", bounds, severity, status, type, verified, search, days],
    queryFn: () =>
      api<Page<RoadReport>>(
        "/reports/map?" +
          queryString({
            ...bounds,
            severity,
            status,
            damageType: type,
            verifiedOnly: verified,
            q: search,
            days,
            pageSize: 200,
          }),
      ),
    placeholderData: (prev) => prev,
  });
  const items = query.data?.items || [];
  return (
    <>
      <PageHeading
        eyebrow="AWARENESS IS A SAFER START"
        title="Know your roads."
        description="Explore community reports, verified hazards, and completed repairs."
        action={
          <Link to="/report" className="button primary">
            <Plus size={18} />
            Report a pothole
          </Link>
        }
      />
      <div className="map-filters">
        <div className="search-input">
          <Search size={18} />
          <input
            aria-label="Search reports by road name"
            placeholder="Search a road or report ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter severity"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          <option value="ALL">All severities</option>
          {severities.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Filter status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="ALL">All statuses</option>
          {statuses
            .filter((s) => s !== "REJECTED")
            .map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
        </select>
        <select
          aria-label="Filter damage type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="ALL">All damage types</option>
          {damages.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter reporting period"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        >
          <option value="">Any time</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
        <label className="check-label">
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => setVerified(e.target.checked)}
          />
          Verified active only
        </label>
      </div>
      {query.error && <ErrorState error={query.error} />}
      <div className="map-page-grid">
        <div className="panel map-full">
          <HazardMap
            reports={items}
            height="100%"
            onBounds={onBounds}
            focus={focus}
          />
        </div>
        <section className="panel nearby-panel">
          <div className="panel-heading">
            <div>
              <h2>In this map area</h2>
              <p>{query.data?.total ?? 0} matching reports</p>
            </div>
            <span className="small-icon">
              <MapPin size={20} />
            </span>
          </div>
          {query.isPending ? (
            <Spinner />
          ) : items.length ? (
            <div className="nearby-list">
              {items.map((r) => (
                <article key={r.id}>
                  <button
                    className="nearby-focus"
                    onClick={() => setFocus([r.latitude, r.longitude])}
                  >
                    <img
                      crossOrigin="use-credentials"
                      src={imageUrl(r.evidenceId)}
                      alt=""
                      loading="lazy"
                    />
                    <span>
                      <strong>{r.roadName}</strong>
                      <small>
                        {label(r.damageType)}
                        {r.isDemo ? " · Demo" : ""}
                      </small>
                    </span>
                  </button>
                  <div className="row between">
                    <Badge value={r.severity} />
                    <Link to={"/reports/" + r.id}>View report ↗</Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="No reports in this area"
              text="Move the map or adjust filters to explore more roads."
            />
          )}
          {(query.data?.total || 0) > 200 && (
            <p className="notice">
              Showing 200 reports. Zoom in or filter to see more.
            </p>
          )}
        </section>
      </div>
      <p className="map-disclaimer">
        <SlidersHorizontal size={14} />
        Pending reports are unverified. Map presence does not establish that a
        road is safe or unsafe.
      </p>
    </>
  );
}
