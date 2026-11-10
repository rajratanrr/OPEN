import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { Crosshair, Maximize2 } from "lucide-react";
import { label } from "../types";
import { getLocation } from "../lib/device";
import type { RoadReport } from "../types";
export type Bounds = {
  south: number;
  north: number;
  west: number;
  east: number;
};
const colors: Record<string, string> = {
  LOW: "#c29a25",
  MEDIUM: "#eb8a38",
  HIGH: "#e16052",
  CRITICAL: "#9a273e",
  UNKNOWN: "#85939c",
  RESOLVED: "#299b79",
  PENDING_REVIEW: "#85939c",
};
const markerIcon = (r: RoadReport) => {
  const color =
    colors[
      r.status === "RESOLVED"
        ? "RESOLVED"
        : r.status === "PENDING_REVIEW"
          ? "PENDING_REVIEW"
          : r.severity
    ];
  return L.divIcon({
    className: "hazard-marker",
    html: `<span style="background:${color}">${r.status === "RESOLVED" ? "✓" : r.status === "PENDING_REVIEW" ? "?" : "!"}</span>`,
    iconSize: [30, 36],
    iconAnchor: [15, 36],
  });
};
const pinIcon = L.divIcon({
  className: "selection-marker",
  html: "<span></span>",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});
function Markers({ reports }: { reports: RoadReport[] }) {
  const map = useMap();
  useEffect(() => {
    const group = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 45,
      iconCreateFunction: (cluster) =>
        L.divIcon({
          html: `<span>${cluster.getChildCount()}</span>`,
          className: "map-cluster",
          iconSize: [38, 38],
        }),
    });
    reports.forEach((r) => {
      const node = document.createElement("div");
      node.className = "map-popup";
      const title = document.createElement("strong");
      title.textContent = r.roadName;
      const p = document.createElement("p");
      p.textContent =
        label(r.severity) +
        " · " +
        label(r.status) +
        (r.isDemo ? " · Demo" : "");
      const link = document.createElement("a");
      link.href = "/reports/" + r.id;
      link.textContent = "View report →";
      node.append(title, p, link);
      group.addLayer(
        L.marker([r.latitude, r.longitude], {
          icon: markerIcon(r),
          title: r.roadName,
          alt: label(r.severity) + " hazard",
        }).bindPopup(node),
      );
    });
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
    };
  }, [map, reports]);
  return null;
}
function Events({
  onBounds,
  onPick,
  focus,
}: {
  onBounds?: (b: Bounds) => void;
  onPick?: (lat: number, lng: number) => void;
  focus?: [number, number];
}) {
  const map = useMapEvents({
    click: (e) => onPick?.(e.latlng.lat, e.latlng.lng),
    moveend: () => update(),
  });
  const update = () => {
    const b = map.getBounds();
    onBounds?.({
      south: Math.max(-90, b.getSouth()),
      north: Math.min(90, b.getNorth()),
      west: Math.max(-180, b.getWest()),
      east: Math.min(180, b.getEast()),
    });
  };
  useEffect(() => {
    update();
    const timer = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(timer);
  }, [map]);
  useEffect(() => {
    if (focus)
      map.setView(focus, Math.max(14, map.getZoom()), { animate: false });
  }, [focus?.[0], focus?.[1], map]);
  return null;
}
export function HazardMap({
  reports = [],
  height = 380,
  onBounds,
  onPick,
  selected,
  focus,
  compact = false,
}: {
  reports?: RoadReport[];
  height?: number | string;
  onBounds?: (b: Bounds) => void;
  onPick?: (lat: number, lng: number) => void;
  selected?: [number, number];
  focus?: [number, number];
  compact?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [location, setLocation] = useState<[number, number]>();
  const [error, setError] = useState("");
  const locate = async () => {
    try {
      const p = await getLocation();
      setError("");
      setLocation([p.coords.latitude, p.coords.longitude]);
      onPick?.(p.coords.latitude, p.coords.longitude);
    } catch {
      setError(
        "Location permission is unavailable. You can select a map pin manually.",
      );
    }
  };
  return (
    <div
      className={"map-wrap " + (compact ? "compact" : "")}
      ref={container}
      style={{ height }}
    >
      <MapContainer
        center={[30.901, 75.8573]}
        zoom={13}
        zoomAnimation={false}
        fadeAnimation={false}
        markerZoomAnimation={false}
        scrollWheelZoom={!compact}
        zoomControl={!compact}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Markers reports={reports} />
        <Events onBounds={onBounds} onPick={onPick} focus={focus || location} />
        {selected && <Marker position={selected} icon={pinIcon} />}
      </MapContainer>
      <div className="map-tools">
        <button
          onClick={locate}
          title="Use current location"
          aria-label="Use current location"
        >
          <Crosshair size={18} />
        </button>
        {!compact && (
          <button
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else
                void container.current
                  ?.requestFullscreen()
                  .catch(() =>
                    setError("Fullscreen is unavailable in this browser."),
                  );
            }}
            aria-label="Toggle fullscreen map"
          >
            <Maximize2 size={18} />
          </button>
        )}
      </div>
      <div className="map-label">
        <span className="live-dot" /> Ludhiana, Punjab
      </div>
      {!compact && (
        <div className="map-legend">
          <span>
            <i style={{ background: colors.HIGH }} />
            High / critical
          </span>
          <span>
            <i style={{ background: colors.MEDIUM }} />
            Medium / low
          </span>
          <span>
            <i style={{ background: colors.PENDING_REVIEW }} />
            Review
          </span>
          <span>
            <i style={{ background: colors.RESOLVED }} />
            Resolved
          </span>
        </div>
      )}
      {error && (
        <div className="map-error" role="status">
          {error}
          <button aria-label="Dismiss map message" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
