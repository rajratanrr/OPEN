import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CloudUpload,
  Download,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { api, queryString } from "../lib/api";
import { drafts, removeDraft, syncDrafts } from "../lib/offline";
import type { Draft } from "../lib/offline";
import { useAuth, useOnline, useToast } from "../app/context";
import {
  Empty,
  ErrorState,
  PageHeading,
  ReportCard,
  Spinner,
} from "../components/ui";
import type { Page, RoadReport } from "../types";
import { label, severities, statuses, date } from "../types";
export default function ReportList({
  municipal = false,
}: {
  municipal?: boolean;
}) {
  const { user } = useAuth();
  const online = useOnline();
  const client = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState("ALL");
  const [severity, setSeverity] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(municipal ? "priority" : "newest");
  const [page, setPage] = useState(0);
  const [outbox, setOutbox] = useState<Draft[]>([]);
  const [tab, setTab] = useState("reports");
  const [syncing, setSyncing] = useState(false);
  const path = municipal ? "/municipal/reports" : "/users/me/reports";
  const query = useQuery({
    queryKey: ["report-list", municipal, status, severity, search, sort, page],
    queryFn: () =>
      api<Page<RoadReport>>(
        path +
          "?" +
          queryString({ status, severity, q: search, sort, page, pageSize: 9 }),
      ),
  });
  useEffect(() => {
    const load = () => {
      if (user) void drafts(user.id).then(setOutbox);
    };
    load();
    window.addEventListener("queue-change", load);
    return () => window.removeEventListener("queue-change", load);
  }, [user?.id]);
  useEffect(() => setPage(0), [status, severity, search, sort]);
  const sync = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const result = await syncDrafts(user.id);
      toast(`${result.length} report${result.length === 1 ? "" : "s"} synced.`);
      await client.invalidateQueries();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setSyncing(false);
    }
  };
  const exportCsv = async () => {
    try {
      const all: RoadReport[] = [];
      let p = 0;
      for (;;) {
        const r = await api<Page<RoadReport>>(
          path +
            "?" +
            queryString({
              status,
              severity,
              q: search,
              sort,
              page: p,
              pageSize: 200,
            }),
        );
        all.push(...r.items);
        if (all.length >= r.total || !r.items.length) break;
        if (++p > 100)
          throw new Error("Export is too large. Narrow the filters.");
      }
      const cell = (v: unknown) =>
        '"' +
        String(v ?? "")
          .replace(/^[\s=+@-]/, "'$&")
          .replaceAll('"', '""') +
        '"';
      const text = [
        ["ID", "Road", "Severity", "Status", "Reported", "Demo"],
        ...all.map((r) => [
          r.id,
          r.roadName,
          r.severity,
          r.status,
          r.createdAt,
          r.isDemo,
        ]),
      ]
        .map((row) => row.map(cell).join(","))
        .join("\r\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(
        new Blob([text], { type: "text/csv;charset=utf-8" }),
      );
      a.download = "roadsaathi-reports.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow={municipal ? "FROM EVIDENCE TO ACTION" : "YOUR CONTRIBUTIONS"}
        title={
          municipal
            ? "Every report deserves a response."
            : "A record of your care."
        }
        description={
          municipal
            ? "Review, verify, and coordinate repairs across your jurisdiction."
            : "Track your reports and the difference they make."
        }
        action={
          municipal ? (
            <button className="button secondary" onClick={exportCsv}>
              <Download size={17} />
              Export CSV
            </button>
          ) : (
            <Link className="button primary" to="/report">
              <Plus size={18} />
              New report
            </Link>
          )
        }
      />
      {!municipal && (
        <div className="tabs">
          <button
            className={tab === "reports" ? "active" : ""}
            onClick={() => setTab("reports")}
          >
            My reports <span>{query.data?.total ?? "—"}</span>
          </button>
          <button
            className={tab === "outbox" ? "active" : ""}
            onClick={() => setTab("outbox")}
          >
            Offline outbox <span>{outbox.length}</span>
          </button>
        </div>
      )}
      {tab === "outbox" ? (
        <section className="panel outbox">
          <div className="panel-heading">
            <div>
              <h2>Ready when you reconnect</h2>
              <p>
                Saved on this device. Keep these drafts until the server
                confirms receipt.
              </p>
            </div>
            <button
              className="button primary"
              disabled={!online || syncing || !outbox.length}
              onClick={sync}
            >
              <CloudUpload size={17} />
              {syncing ? "Syncing…" : "Sync reports"}
            </button>
          </div>
          {outbox.length ? (
            outbox.map((d) => (
              <div key={d.id} className="outbox-row">
                <CloudUpload size={23} />
                <div>
                  <strong>{d.input.roadName}</strong>
                  <p>{d.input.description}</p>
                  <small>Saved {date(d.createdAt)}</small>
                  {d.error && <p className="field-error">{d.error}</p>}
                </div>
                <button
                  className="icon-button"
                  aria-label={"Delete draft " + d.input.roadName}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Delete this unsent draft from this device?",
                      )
                    )
                      void removeDraft(d.id);
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          ) : (
            <Empty
              title="Your outbox is clear"
              text="Reports saved offline will wait here until you reconnect."
            />
          )}
        </section>
      ) : (
        <>
          <div className="report-toolbar">
            <div className="search-input">
              <Search size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search road or report ID…"
                aria-label="Search reports"
              />
            </div>
            <select
              aria-label="Report status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="ALL">All statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
            <select
              aria-label="Report severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option value="ALL">All severities</option>
              {severities.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
            <select
              aria-label="Sort reports"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="priority">Highest severity</option>
            </select>
          </div>
          {query.isPending ? (
            <Spinner />
          ) : query.error ? (
            <ErrorState
              error={query.error}
              retry={() => void query.refetch()}
            />
          ) : query.data?.items.length ? (
            <>
              <div className="report-grid">
                {query.data.items.map((r) => (
                  <ReportCard key={r.id} report={r} />
                ))}
              </div>
              <div className="pagination">
                <span>
                  {query.data.total} reports · Page {page + 1} of{" "}
                  {Math.max(1, Math.ceil(query.data.total / 9))}
                </span>
                <div className="row">
                  <button
                    className="button secondary small-button"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ArrowLeft size={16} />
                    Previous
                  </button>
                  <button
                    className="button secondary small-button"
                    disabled={(page + 1) * 9 >= query.data.total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <Empty
              title="No reports found"
              text="Adjust your filters or submit your first road report."
              action={
                <Link className="button primary" to="/report">
                  Report a pothole
                </Link>
              }
            />
          )}
        </>
      )}
    </>
  );
}
