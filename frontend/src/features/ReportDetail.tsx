import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Clock3,
  MapPin,
  Pencil,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  UploadCloud,
} from "lucide-react";
import { api, patch, post, upload } from "../lib/api";
import { useAuth, useToast } from "../app/context";
import { Badge, ErrorState, Field, Panel, Spinner } from "../components/ui";
import { HazardMap } from "../components/HazardMap";
import type { RoadReport, Status } from "../types";
import { label, date, imageUrl, severities, damages } from "../types";
export default function ReportDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const client = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({
    roadName: "",
    description: "",
    damageType: "POTHOLE",
    severity: "UNKNOWN",
  });
  const [reason, setReason] = useState("");
  const [officer, setOfficer] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [due, setDue] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  );
  const [note, setNote] = useState("");
  const query = useQuery({
    queryKey: ["report", id],
    queryFn: () => api<RoadReport>("/reports/" + id),
  });
  const r = query.data;
  const { data: officers = [] } = useQuery({
    queryKey: ["officers"],
    queryFn: () => api<{ id: string; name: string }[]>("/municipal/officers"),
    enabled: !!r?.canManage,
  });
  useEffect(() => {
    if (r)
      setEdit({
        roadName: r.roadName,
        description: r.description,
        damageType: r.damageType,
        severity: r.severity,
      });
  }, [r?.id, r?.updatedAt]);
  useEffect(() => {
    if (!officer && officers.length)
      setOfficer(officers.find((o) => o.id === user?.id)?.id || officers[0].id);
  }, [officers, officer, user?.id]);
  const mutate = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
      await client.invalidateQueries();
      toast(message);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const status = (next: Status) =>
    mutate(
      () =>
        patch("/municipal/reports/" + id + "/status", {
          status: next,
          reason:
            reason ||
            (next === "VERIFIED" && r?.status === "PENDING_REVIEW"
              ? "Photographic evidence reviewed by municipal officer."
              : ""),
          assignedTo: officer || null,
          priority,
          dueDate: due,
          ...(r?.status === "PENDING_REVIEW" &&
          (edit.damageType !== r.damageType || edit.severity !== r.severity)
            ? { damageType: edit.damageType, severity: edit.severity }
            : {}),
        }),
      "Report status updated.",
    );
  if (query.isPending) return <Spinner />;
  if (query.error || !r)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  return (
    <>
      <Link
        className="back-link"
        to={r.canManage ? "/municipal/reports" : "/my-reports"}
      >
        <ArrowLeft size={16} />
        Back to reports
      </Link>
      <div className="detail-heading">
        <div>
          <span className="eyebrow">
            RS–{r.id.slice(0, 8).toUpperCase()}{" "}
            {r.isDemo ? "· DEMONSTRATION REPORT" : ""}
          </span>
          <h1>{r.roadName}</h1>
          <p>
            <MapPin size={16} />
            Ludhiana, Punjab <span>·</span>Reported {date(r.createdAt)}
          </p>
        </div>
        <div className="row">
          <Badge value={r.severity} />
          <Badge value={r.status} />
        </div>
      </div>
      {error != null && <ErrorState error={error} />}
      <div className="detail-grid">
        <div>
          <Panel className="evidence-panel">
            <img
              className="detail-photo"
              crossOrigin="use-credentials"
              src={imageUrl(r.evidenceId)}
              alt={"Reported road damage at " + r.roadName}
            />
            <div className="detail-description">
              <div className="row between">
                <h2>What was reported</h2>
                {r.isOwner && r.status === "PENDING_REVIEW" && (
                  <button
                    className="text-button"
                    onClick={() => setEditing(!editing)}
                  >
                    <Pencil size={16} />
                    Edit report
                  </button>
                )}
              </div>
              {editing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void mutate(async () => {
                      await patch("/reports/" + id, edit);
                      setEditing(false);
                    }, "Report updated.");
                  }}
                >
                  <Field label="Road name">
                    <input
                      required
                      minLength={3}
                      maxLength={180}
                      value={edit.roadName}
                      onChange={(e) =>
                        setEdit({ ...edit, roadName: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Description">
                    <textarea
                      required
                      minLength={10}
                      maxLength={3000}
                      value={edit.description}
                      onChange={(e) =>
                        setEdit({ ...edit, description: e.target.value })
                      }
                    />
                  </Field>
                  <div className="form-grid">
                    <Field label="Damage type">
                      <select
                        value={edit.damageType}
                        onChange={(e) =>
                          setEdit({ ...edit, damageType: e.target.value })
                        }
                      >
                        {damages.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Severity">
                      <select
                        value={edit.severity}
                        onChange={(e) =>
                          setEdit({ ...edit, severity: e.target.value })
                        }
                      >
                        {severities.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <button className="button primary" disabled={busy}>
                    Save changes
                  </button>
                </form>
              ) : (
                <>
                  <p>{r.description}</p>
                  <div className="review-meta">
                    <span>{label(r.damageType)}</span>
                    <span>Updated {date(r.updatedAt)}</span>
                    {r.gpsAccuracyMeters != null && (
                      <span>GPS ±{Math.round(r.gpsAccuracyMeters)} m</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </Panel>
          <Panel
            title="Preliminary assessment"
            action={<Sparkles size={21} />}
            className="analysis-panel"
          >
            {r.aiAnalysis?.result ? (
              <>
                <div className="row">
                  <Badge value={r.aiAnalysis.result.severity} />
                  <small>
                    Confidence: {label(r.aiAnalysis.result.confidence_level)}
                  </small>
                </div>
                <p>{r.aiAnalysis.result.description}</p>
                <ul>
                  {r.aiAnalysis.result.visible_risk_factors.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p>
                No AI assessment is available for this report. The submitted
                category and severity require human review.
              </p>
            )}
            <div className="notice">
              <ShieldCheck size={18} />
              AI does not establish exact dimensions or physical danger from a
              photograph.
            </div>
          </Panel>
          {!!r.repairEvidence?.length && (
            <Panel
              title="Repair evidence"
              subtitle="Submitted by the municipal team"
            >
              <div className="repair-gallery">
                {r.repairEvidence.map((e) => (
                  <figure key={e.id}>
                    <img
                      crossOrigin="use-credentials"
                      src={imageUrl(e.evidenceId)}
                      alt="Repair completion evidence"
                    />
                    <figcaption>
                      {e.notes || "Repair photograph"} · {date(e.createdAt)}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </Panel>
          )}
          <Panel title="Report location" subtitle={r.organizationName}>
            <HazardMap
              reports={[r]}
              height={250}
              focus={[r.latitude, r.longitude]}
            />
          </Panel>
        </div>
        <div>
          <Panel
            title="The journey to a safer road"
            subtitle="A record of every status update"
            className="timeline-panel"
          >
            <ol className="timeline">
              {r.history?.map((h, i) => (
                <li
                  key={h.id}
                  className={i === r.history!.length - 1 ? "current" : ""}
                >
                  <span className="timeline-dot">
                    {h.newStatus === "RESOLVED" ? (
                      <CheckCheck size={16} />
                    ) : (
                      <Check size={14} />
                    )}
                  </span>
                  <strong>{label(h.newStatus)}</strong>
                  <time>
                    {new Date(h.changedAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                  <p>{h.reason || "Status updated by the city team."}</p>
                </li>
              ))}
            </ol>
          </Panel>
          {r.canManage ? (
            <Panel
              title="Municipal actions"
              subtitle="Changes are recorded in the report timeline"
            >
              <p className="muted">{r.priorityExplanation}</p>
              {r.assignedOfficer && (
                <div className="assignment">
                  <ShieldCheck size={18} />
                  <span>
                    Assigned to <strong>{r.assignedOfficer}</strong>
                    <small>Target: {r.dueDate || "Not set"}</small>
                  </span>
                </div>
              )}
              <Field
                label="Public reason or repair note"
                hint="Required for rejection, reopening, or resolution without a photo."
              >
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={1500}
                  rows={3}
                  placeholder="Explain the decision or work completed…"
                />
              </Field>
              {r.status === "PENDING_REVIEW" && (
                <div className="form-grid">
                  <Field label="Reviewed category">
                    <select
                      value={edit.damageType}
                      onChange={(e) =>
                        setEdit({ ...edit, damageType: e.target.value })
                      }
                    >
                      {damages.map((v) => (
                        <option key={v} value={v}>
                          {label(v)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Reviewed severity">
                    <select
                      value={edit.severity}
                      onChange={(e) =>
                        setEdit({ ...edit, severity: e.target.value })
                      }
                    >
                      {severities.map((v) => (
                        <option key={v} value={v}>
                          {label(v)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}
              {["VERIFIED", "ASSIGNED"].includes(r.status) && (
                <>
                  <Field label="Assign officer">
                    <select
                      value={officer}
                      onChange={(e) => setOfficer(e.target.value)}
                    >
                      {officers.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="form-grid">
                    <Field label="Priority">
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                      >
                        {["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Target date">
                      <input
                        type="date"
                        value={due}
                        onChange={(e) => setDue(e.target.value)}
                      />
                    </Field>
                  </div>
                </>
              )}
              <div className="action-stack">
                {r.status === "PENDING_REVIEW" && (
                  <button
                    disabled={busy}
                    className="button primary"
                    onClick={() => status("VERIFIED")}
                  >
                    <ShieldCheck size={17} />
                    Verify report
                  </button>
                )}
                {r.status === "VERIFIED" && (
                  <button
                    disabled={busy || !officer}
                    className="button primary"
                    onClick={() => status("ASSIGNED")}
                  >
                    Assign repair
                  </button>
                )}
                {["PENDING_REVIEW", "VERIFIED"].includes(r.status) && (
                  <button
                    disabled={busy}
                    className="button danger-outline"
                    onClick={() => status("REJECTED")}
                  >
                    Reject with reason
                  </button>
                )}
                {r.status === "ASSIGNED" && (
                  <button
                    disabled={busy || !officer}
                    className="button secondary"
                    onClick={() => status("ASSIGNED")}
                  >
                    Update assignment
                  </button>
                )}
                {r.status === "ASSIGNED" && (
                  <button
                    disabled={busy}
                    className="button primary"
                    onClick={() => status("IN_PROGRESS")}
                  >
                    Start repair
                  </button>
                )}
                {r.status === "IN_PROGRESS" && (
                  <>
                    <label className="button secondary file-button">
                      <UploadCloud size={17} />
                      Upload repair evidence
                      <input
                        disabled={busy}
                        type="file"
                        accept="image/png,image/jpeg"
                        aria-label="Repair evidence photograph"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f)
                            void mutate(async () => {
                              const photo = await upload(f);
                              await post(
                                "/municipal/reports/" + id + "/repair-evidence",
                                { evidenceId: photo.id, notes: reason },
                              );
                            }, "Repair evidence saved.");
                        }}
                      />
                    </label>
                    <button
                      disabled={busy}
                      className="button primary"
                      onClick={() => status("RESOLVED")}
                    >
                      <CheckCheck size={18} />
                      Mark resolved
                    </button>
                  </>
                )}
                {r.status === "RESOLVED" && (
                  <button
                    disabled={busy}
                    className="button secondary"
                    onClick={() => status("VERIFIED")}
                  >
                    Reopen with reason
                  </button>
                )}
              </div>
              <hr />
              <Field
                label="Internal note"
                hint="Visible only to authorized city staff."
              >
                <textarea
                  value={note}
                  maxLength={1500}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
              </Field>
              <button
                className="button secondary full"
                disabled={busy || !note.trim()}
                onClick={() =>
                  mutate(async () => {
                    await post("/municipal/reports/" + id + "/notes", { note });
                    setNote("");
                  }, "Internal note saved.")
                }
              >
                Save internal note
              </button>
              {r.internalNotes?.map((n) => (
                <div key={n.id} className="internal-note">
                  <strong>{n.author}</strong>
                  <p>{n.note}</p>
                </div>
              ))}
            </Panel>
          ) : (
            <Panel
              title="Seen this hazard too?"
              subtitle={`${r.confirmations} independent confirmations`}
            >
              <p className="muted">
                An accurate confirmation helps the city understand a report.
                Only confirm what you have seen.
              </p>
              {!user ? (
                <Link to="/login" className="button secondary full">
                  Sign in to confirm
                </Link>
              ) : r.isOwner ? (
                <div className="notice">
                  <Check size={17} />
                  You reported this hazard.
                </div>
              ) : (
                !["RESOLVED", "REJECTED"].includes(r.status) && (
                  <button
                    className="button secondary full"
                    disabled={busy}
                    onClick={() =>
                      mutate(
                        () =>
                          api("/reports/" + id + "/confirm", {
                            method: r.isConfirmed ? "DELETE" : "POST",
                          }),
                        r.isConfirmed
                          ? "Confirmation removed."
                          : "Confirmation saved.",
                      )
                    }
                  >
                    <ThumbsUp size={18} />
                    {r.isConfirmed
                      ? "Remove my confirmation"
                      : "I’ve seen this too"}
                  </button>
                )
              )}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
