import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Camera,
  CheckCheck,
  ClipboardList,
  Clock3,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth, useConfig } from "../app/context";
import { api } from "../lib/api";
import {
  Badge,
  Empty,
  ErrorState,
  PageHeading,
  Panel,
  Spinner,
  StatCard,
} from "../components/ui";
import { HazardMap } from "../components/HazardMap";
import type {
  Stats,
  Page,
  RoadReport,
  Notification,
  MunicipalSummary,
} from "../types";
import { imageUrl, date } from "../types";
export default function Dashboard({
  municipal = false,
}: {
  municipal?: boolean;
}) {
  const { user } = useAuth();
  const { data: config } = useConfig();
  const stats = useQuery({
    queryKey: [municipal ? "municipal-summary" : "my-stats"],
    queryFn: () =>
      api<Stats & MunicipalSummary>(
        municipal ? "/analytics/municipal-summary" : "/users/me/stats",
      ),
  });
  const reports = useQuery({
    queryKey: ["recent-reports", municipal],
    queryFn: () =>
      api<Page<RoadReport>>(
        municipal
          ? "/municipal/reports?pageSize=5&sort=priority"
          : "/users/me/reports?pageSize=5",
      ),
  });
  const mapReports = useQuery({
    queryKey: ["dashboard-map"],
    queryFn: () =>
      api<Page<RoadReport>>(
        "/reports/map?south=30.8&north=31&west=75.75&east=76&pageSize=100",
      ),
  });
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<Notification[]>("/notifications"),
  });
  const s = stats.data;
  return (
    <>
      <PageHeading
        eyebrow={
          municipal ? "MUNICIPAL COMMAND CENTER" : "EVERY CONTRIBUTION COUNTS"
        }
        title={
          municipal
            ? "A clearer picture. A safer city."
            : `Hello, ${user?.name.split(" ")[0] || "neighbour"}.`
        }
        description={
          municipal
            ? "Review road hazards, coordinate repairs, and keep Ludhiana moving."
            : "Here’s how you’re helping make Ludhiana’s roads a little safer."
        }
        action={
          <Link
            className="button primary"
            to={municipal ? "/municipal/reports" : "/report"}
          >
            {municipal ? <ClipboardList size={18} /> : <Plus size={19} />}{" "}
            {municipal ? "Review reports" : "Report a pothole"}
          </Link>
        }
      />
      {stats.error && (
        <ErrorState error={stats.error} retry={() => void stats.refetch()} />
      )}
      {!municipal && (
        <section className="welcome-banner">
          <div>
            <span className="welcome-kicker">
              <span className="live-dot" /> YOUR CITY. YOUR IMPACT.
            </span>
            <h2>
              A small report can make
              <br />a big difference.
            </h2>
            <p>Spotted road damage? Let’s get it on the map.</p>
            <Link to="/report">
              Make your next report <ArrowRight size={17} />
            </Link>
          </div>
          <div className="welcome-art" aria-hidden="true">
            <div className="road-curve" />
            <div className="art-pin">
              <MapPin size={35} />
            </div>
            <div className="art-check">
              <CheckCheck size={22} />
              <span>Safer together</span>
            </div>
            <span className="art-cross one">+</span>
            <span className="art-cross two">+</span>
          </div>
        </section>
      )}
      <div className="stat-grid">
        {municipal ? (
          <>
            <StatCard
              title="Awaiting review"
              value={s?.pending ?? "—"}
              icon={<ClipboardList size={20} />}
              note="Ready for your attention"
              color="orange"
            />
            <StatCard
              title="Critical hazards"
              value={s?.critical ?? "—"}
              icon={<TriangleAlert size={20} />}
              note="Active critical reports"
              color="red"
            />
            <StatCard
              title="Repairs in progress"
              value={s?.inProgress ?? "—"}
              icon={<Wrench size={20} />}
              note="Work is underway"
            />
            <StatCard
              title="Resolved reports"
              value={s?.resolved ?? "—"}
              icon={<CheckCheck size={20} />}
              note={
                s?.averageResolutionDays != null
                  ? `${s.averageResolutionDays} days average resolution`
                  : "No resolution time recorded"
              }
            />
          </>
        ) : (
          <>
            <StatCard
              title="My reports"
              value={s?.total ?? "—"}
              icon={<ClipboardList size={20} />}
              note="Every report is a step forward"
            />
            <StatCard
              title="Verified reports"
              value={s?.verified ?? "—"}
              icon={<ShieldCheck size={20} />}
              note="Reviewed by your city team"
              color="blue"
            />
            <StatCard
              title="Repairs completed"
              value={s?.resolved ?? "—"}
              icon={<CheckCheck size={20} />}
              note="A safer journey for everyone"
            />
            <StatCard
              title="Contribution points"
              value={s?.points ?? "—"}
              icon={<Trophy size={20} />}
              note="Your care makes a difference"
              color="orange"
            />
          </>
        )}
      </div>
      <div className="dashboard-grid">
        <Panel
          title="Your city at a glance"
          subtitle="Community reports across Ludhiana"
          action={
            <Link className="text-link" to="/map">
              Explore map <ArrowUpRight size={16} />
            </Link>
          }
          className="map-panel"
        >
          <HazardMap reports={mapReports.data?.items || []} height={350} />
          <div className="map-panel-footer">
            <span>
              <span className="live-dot" />
              Updates from the reporting database
            </span>
            <small>
              {config?.demoMode
                ? "Includes labeled demo reports"
                : "Human verification required for new hazards"}
            </small>
          </div>
        </Panel>
        <Panel
          title={municipal ? "Repair performance" : "Your next good deed"}
          subtitle={
            municipal
              ? "Reports created over the last 14 days"
              : "Small actions. Real community value."
          }
          className="quick-panel"
        >
          {municipal && s ? (
            <>
              <div className="mini-chart">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={s.trends}>
                    <defs>
                      <linearGradient
                        id="trendFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#169d7e"
                          stopOpacity={0.23}
                        />
                        <stop
                          offset="100%"
                          stopColor="#169d7e"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#edf1f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      interval={5}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      width={25}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="reports"
                      stroke="#0e9278"
                      strokeWidth={2.5}
                      fill="url(#trendFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <Link className="button secondary full" to="/analytics">
                Open road insights <ArrowRight size={16} />
              </Link>
            </>
          ) : (
            <div className="quick-actions">
              {[
                {
                  to: "/report",
                  icon: Camera,
                  title: "Report road damage",
                  text: "A photo can start a repair.",
                },
                {
                  to: "/monitor",
                  icon: Activity,
                  title: "Start road monitoring",
                  text: "Let supported sensors help.",
                },
                {
                  to: "/map",
                  icon: MapPin,
                  title: "Explore nearby hazards",
                  text: "A little awareness goes a long way.",
                },
                {
                  to: "/rewards",
                  icon: Trophy,
                  title: "See your community impact",
                  text: "Good contributions add up.",
                },
              ].map(({ to, icon: Icon, title, text }) => (
                <Link key={to} to={to}>
                  <span className="action-icon">
                    <Icon size={21} />
                  </span>
                  <div>
                    <strong>{title}</strong>
                    <small>{text}</small>
                  </div>
                  <ArrowUpRight size={17} />
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>
      <div className="dashboard-grid">
        <Panel
          title={
            municipal ? "Reports needing attention" : "Your recent reports"
          }
          subtitle={
            municipal
              ? "Ordered by severity, then oldest first"
              : "From your first report to the final repair"
          }
          action={
            <Link
              className="text-link"
              to={municipal ? "/municipal/reports" : "/my-reports"}
            >
              View all <ArrowRight size={16} />
            </Link>
          }
        >
          {reports.isPending ? (
            <Spinner />
          ) : reports.error ? (
            <ErrorState error={reports.error} />
          ) : reports.data?.items.length ? (
            <div className="report-table-scroll">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Location & report</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th aria-label="Open report" />
                  </tr>
                </thead>
                <tbody>
                  {reports.data.items.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link to={"/reports/" + r.id} className="report-cell">
                          <img
                            crossOrigin="use-credentials"
                            src={imageUrl(r.evidenceId)}
                            alt=""
                          />
                          <span>
                            <strong>{r.roadName}</strong>
                            <small>
                              {date(r.createdAt)} {r.isDemo ? "· Demo" : ""}
                            </small>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <Badge value={r.severity} />
                      </td>
                      <td>
                        <Badge value={r.status} />
                      </td>
                      <td>
                        <Link
                          to={"/reports/" + r.id}
                          className="icon-button"
                          aria-label={"View " + r.roadName}
                        >
                          <ArrowUpRight size={18} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Your first report starts here"
              text="Spotted a damaged road? Share a photo and location."
              action={
                <Link to="/report" className="button secondary">
                  Report a pothole
                </Link>
              }
            />
          )}
        </Panel>
        <Panel
          title="Latest updates"
          subtitle="Progress worth knowing about"
          action={
            <Link to="/notifications" aria-label="All notifications">
              <ArrowUpRight size={18} />
            </Link>
          }
        >
          {notifications.length ? (
            <div className="activity-list">
              {notifications.slice(0, 4).map((n) => (
                <Link key={n.id} to={"/reports/" + n.reportId}>
                  <span className={"activity-dot " + (!n.isRead ? "new" : "")}>
                    <CheckCheck size={16} />
                  </span>
                  <div>
                    <strong>{n.title}</strong>
                    <p>{n.message}</p>
                    <small>{date(n.createdAt)}</small>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title="You’re all caught up"
              text="Updates about your reports will appear here."
            />
          )}
          <div className="insight-note">
            <Sparkles size={18} />
            <p>
              {config?.aiEnabled
                ? "AI assessments are preliminary. Your city team makes the final verification."
                : "AI analysis is not connected yet. Photo reporting and municipal review are available."}
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
