import { cloneElement, isValidElement, useId } from "react";
import type { ReactNode, ReactElement } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  FileSearch,
  LoaderCircle,
  MapPin,
  TriangleAlert,
} from "lucide-react";
import { label, date, imageUrl } from "../types";
import type { RoadReport } from "../types";
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link
      className={"logo " + (light ? "light" : "")}
      to="/"
      aria-label="RoadSaathi home"
    >
      <img src="/icon.svg" alt="" />
      <span>
        RoadSaathi<small>AI</small>
      </span>
    </Link>
  );
}
export function Badge({ value }: { value: string }) {
  return (
    <span className={"badge " + value.toLowerCase()}>
      <span className="badge-dot" />
      {label(value)}
    </span>
  );
}
export function Spinner({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} />
      {text}
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="notice error" role="alert">
      <TriangleAlert size={19} />
      <div>
        {error instanceof Error ? error.message : "Something went wrong."}
        {retry && (
          <button className="text-button" onClick={retry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
export function Empty({
  title = "Nothing here yet",
  text = "Your activity will appear here.",
  action,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <FileSearch size={26} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function StatCard({
  title,
  value,
  icon,
  note,
  color = "teal",
}: {
  title: string;
  value: string | number;
  icon: ReactNode;
  note?: string;
  color?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{title}</span>
        <span className={"stat-icon " + color}>{icon}</span>
      </div>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"panel " + className}>
      {title && (
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function ReportCard({ report: r }: { report: RoadReport }) {
  return (
    <Link to={"/reports/" + r.id} className="report-card">
      <div className="report-image">
        <img
          crossOrigin="use-credentials"
          src={imageUrl(r.evidenceId)}
          alt={"Evidence at " + r.roadName}
          loading="lazy"
        />
        <Badge value={r.severity} />
        {r.isDemo && <span className="demo-tag">Demo</span>}
      </div>
      <div className="report-card-body">
        <div className="row between">
          <small className="mono">RS–{r.id.slice(0, 6).toUpperCase()}</small>
          <ArrowUpRight size={17} />
        </div>
        <h3>{r.roadName}</h3>
        <p>
          <MapPin size={13} /> Ludhiana · {date(r.createdAt)}
        </p>
        <div className="row between">
          <Badge value={r.status} />
          <small>{r.confirmations} confirmations</small>
        </div>
      </div>
    </Link>
  );
}
export function Field({
  label: labelText,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  const control =
    isValidElement(children) &&
    typeof children.type === "string" &&
    ["input", "select", "textarea"].includes(children.type)
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          "aria-labelledby": id + "-label",
          "aria-describedby":
            [hint ? id + "-hint" : "", error ? id + "-error" : ""]
              .filter(Boolean)
              .join(" ") || undefined,
          "aria-invalid": error ? true : undefined,
        })
      : children;
  return (
    <label className="field">
      <span id={id + "-label"}>{labelText}</span>
      {control}
      {hint && <small id={id + "-hint"}>{hint}</small>}
      {error && (
        <small id={id + "-error"} className="field-error" role="alert">
          {error}
        </small>
      )}
    </label>
  );
}
export function Steps({
  labels,
  active,
}: {
  labels: string[];
  active: number;
}) {
  return (
    <div className="steps">
      {labels.map((s, i) => (
        <div key={s} className={i <= active ? "active" : ""}>
          <span>{i < active ? <Check size={15} /> : i + 1}</span>
          <b>{s}</b>
        </div>
      ))}
    </div>
  );
}
