import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CheckCheck, Clock3, ClipboardList, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import {
  Empty,
  ErrorState,
  PageHeading,
  Panel,
  Spinner,
  StatCard,
} from "../components/ui";
import type { MunicipalSummary } from "../types";
import { label } from "../types";
const palette = [
  "#11876f",
  "#77baaa",
  "#e9a45c",
  "#d96555",
  "#8696a2",
  "#bac9be",
];
export default function Analytics() {
  const q = useQuery({
    queryKey: ["municipal-summary"],
    queryFn: () => api<MunicipalSummary>("/analytics/municipal-summary"),
  });
  const performance = useQuery({
    queryKey: ["performance"],
    queryFn: () =>
      api<
        {
          name: string;
          reports: number;
          resolved: number;
          days: number | null;
        }[]
      >("/analytics/resolution-performance"),
  });
  if (q.isPending) return <Spinner />;
  if (q.error || !q.data) return <ErrorState error={q.error} />;
  const s = q.data;
  return (
    <>
      <PageHeading
        eyebrow="INFORMED DECISIONS. BETTER ROADS."
        title="The bigger picture."
        description="Real reporting and repair data from your authorized jurisdiction."
        action={
          <Link to="/municipal/reports" className="button secondary">
            View & export reports ↗
          </Link>
        }
      />
      <div className="stat-grid">
        <StatCard
          title="Total reports"
          value={s.total}
          icon={<ClipboardList size={20} />}
        />
        <StatCard
          title="Repairs completed"
          value={s.resolved}
          icon={<CheckCheck size={20} />}
        />
        <StatCard
          title="Resolution rate"
          value={s.total ? Math.round((s.resolved / s.total) * 100) + "%" : "—"}
          icon={<TrendingUp size={20} />}
        />
        <StatCard
          title="Average resolution"
          value={
            s.averageResolutionDays == null
              ? "—"
              : s.averageResolutionDays + " days"
          }
          icon={<Clock3 size={20} />}
        />
      </div>
      <div className="analytics-grid">
        <Panel
          title="From reports to resolutions"
          subtitle="Reports created in each of the last 14 days; resolved is their current status"
        >
          <ResponsiveContainer width="100%" height={290}>
            <AreaChart
              data={s.trends}
              margin={{ top: 15, right: 12, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="analyticsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="#0e9278" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#0e9278" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#edf1f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={30}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip />
              <Area
                dataKey="reports"
                type="monotone"
                stroke="#0e9278"
                fill="url(#analyticsFill)"
                strokeWidth={2.5}
              />
              <Area
                dataKey="resolved"
                type="monotone"
                stroke="#dfaa62"
                fill="transparent"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="chart-key">
            <span>
              <i style={{ background: "#0e9278" }} />
              Reports
            </span>
            <span>
              <i style={{ background: "#dfaa62" }} />
              Now resolved
            </span>
          </div>
        </Panel>
        <Panel
          title="Severity distribution"
          subtitle="As recorded in the report database"
        >
          {s.bySeverity.length ? (
            <>
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie
                    data={s.bySeverity}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                  >
                    {s.bySeverity.map((x, i) => (
                      <Cell key={x.name} fill={palette[i % palette.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="chart-key wrap">
                {s.bySeverity.map((x, i) => (
                  <span key={x.name}>
                    <i style={{ background: palette[i % palette.length] }} />
                    {label(x.name)} {x.value}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <Empty />
          )}
        </Panel>
      </div>
      <div className="dashboard-grid">
        <Panel title="Repair pipeline" subtitle="Where reports stand today">
          <ResponsiveContainer width="100%" height={270}>
            <BarChart
              data={s.byStatus.map((x) => ({ ...x, name: label(x.name) }))}
              layout="vertical"
              margin={{ left: 15, right: 25 }}
            >
              <CartesianGrid horizontal={false} stroke="#edf1f0" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis
                dataKey="name"
                type="category"
                width={100}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip />
              <Bar
                dataKey="value"
                fill="#168d75"
                radius={[0, 5, 5, 0]}
                barSize={22}
              />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Damage categories" subtitle="What citizens are reporting">
          <ResponsiveContainer width="100%" height={270}>
            <BarChart
              data={s.byDamage.map((x) => ({ ...x, name: label(x.name) }))}
              margin={{ left: -20, right: 20 }}
            >
              <CartesianGrid vertical={false} stroke="#edf1f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar
                dataKey="value"
                fill="#7ab8aa"
                radius={[5, 5, 0, 0]}
                barSize={42}
              />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
      <Panel
        title="Roads that need attention"
        subtitle="Report volume and recorded completion by road"
      >
        <div className="report-table-scroll">
          <table className="report-table">
            <thead>
              <tr>
                <th>Road</th>
                <th>Reports</th>
                <th>Resolved</th>
                <th>Average resolution</th>
              </tr>
            </thead>
            <tbody>
              {performance.data?.map((p) => (
                <tr key={p.name}>
                  <td>
                    <strong>{p.name}</strong>
                  </td>
                  <td>{p.reports}</td>
                  <td>{p.resolved}</td>
                  <td>
                    {p.days == null ? "Not yet available" : p.days + " days"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel
        title="Unresolved hazard concentrations"
        subtitle="Grouped into approximately 100 m coordinate cells; not a traffic-risk model"
      >
        <div className="hotspot-grid">
          {s.hotspots.slice(0, 8).map((h, i) => (
            <div key={i}>
              <span className="hotspot-number">{h.count}</span>
              <div>
                <strong>
                  {h.latitude}, {h.longitude}
                </strong>
                <small>{h.critical} high or critical reports</small>
              </div>
            </div>
          ))}
        </div>
        {!s.hotspots.length && <Empty title="No unresolved concentrations" />}
      </Panel>
    </>
  );
}
