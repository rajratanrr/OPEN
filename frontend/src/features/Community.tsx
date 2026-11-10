import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Bell,
  CheckCheck,
  Medal,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { api, patch } from "../lib/api";
import { useAuth, useToast } from "../app/context";
import {
  Empty,
  ErrorState,
  PageHeading,
  Panel,
  Spinner,
  StatCard,
} from "../components/ui";
import type { Notification } from "../types";
import { date, label } from "../types";
export function Notifications() {
  const client = useQueryClient();
  const toast = useToast();
  const [unread, setUnread] = useState(false);
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<Notification[]>("/notifications"),
  });
  const mark = async (id?: string) => {
    try {
      await patch(
        id ? "/notifications/" + id + "/read" : "/notifications/read-all",
      );
      await client.invalidateQueries({ queryKey: ["notifications"] });
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  const list = q.data?.filter((n) => !unread || !n.isRead) || [];
  return (
    <>
      <PageHeading
        eyebrow="GOOD TO KNOW"
        title="Your city is making progress."
        description="Updates on your reports, reviews, and repairs."
        action={
          <button className="button secondary" onClick={() => mark()}>
            <CheckCheck size={18} />
            Mark all as read
          </button>
        }
      />
      <div className="tabs">
        <button
          className={!unread ? "active" : ""}
          onClick={() => setUnread(false)}
        >
          All updates
        </button>
        <button
          className={unread ? "active" : ""}
          onClick={() => setUnread(true)}
        >
          Unread <span>{q.data?.filter((n) => !n.isRead).length || 0}</span>
        </button>
      </div>
      <Panel>
        {q.isPending ? (
          <Spinner />
        ) : q.error ? (
          <ErrorState error={q.error} />
        ) : list.length ? (
          <div className="notification-list">
            {list.map((n) => (
              <article className={n.isRead ? "" : "unread"} key={n.id}>
                <span className="notification-icon">
                  <Bell size={20} />
                </span>
                <div>
                  <Link
                    onClick={() => void mark(n.id)}
                    to={"/reports/" + n.reportId}
                  >
                    <h3>{n.title}</h3>
                    <p>{n.message}</p>
                  </Link>
                  <small>
                    {new Date(n.createdAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </small>
                </div>
                {!n.isRead && (
                  <button className="text-button" onClick={() => mark(n.id)}>
                    Mark read
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="You’re all caught up"
            text="We’ll keep you posted when your reports make progress."
          />
        )}
      </Panel>
    </>
  );
}
export function Rewards() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["rewards"],
    queryFn: () =>
      api<{
        points: number;
        verified: number;
        submitted: number;
        badges: string[];
      }>("/rewards/me"),
  });
  const leaders = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () =>
      api<{ name: string; points: number; verified: number }[]>(
        "/rewards/leaderboard",
      ),
  });
  const history = useQuery({
    queryKey: ["reward-history"],
    queryFn: () =>
      api<
        {
          id: string;
          reportId: string;
          points: number;
          reason: string;
          createdAt: string;
        }[]
      >("/rewards/history"),
  });
  return (
    <>
      <PageHeading
        eyebrow="GOOD CONTRIBUTIONS ADD UP"
        title="A little recognition for a lot of care."
        description="Your accurate reports and useful confirmations help make roads safer."
      />
      <section className="rewards-banner">
        <Trophy size={56} strokeWidth={1.4} />
        <div>
          <span>YOUR CONTRIBUTION POINTS</span>
          <strong>{q.data?.points ?? "—"}</strong>
          <p>
            Thank you for looking out for your community,{" "}
            {user?.name.split(" ")[0]}.
          </p>
        </div>
        <Link className="button mint" to="/report">
          Make a new contribution ↗
        </Link>
      </section>
      {q.error && <ErrorState error={q.error} />}
      <div className="dashboard-grid">
        <Panel
          title="Milestones that matter"
          subtitle="Earned through verified contributions"
        >
          <div className="badge-grid">
            {[
              {
                name: "First Reporter",
                desc: "Submit your first report",
                icon: Award,
              },
              {
                name: "Road Guardian",
                desc: "5 verified reports",
                icon: ShieldCheck,
              },
              {
                name: "Community Protector",
                desc: "20 verified reports",
                icon: Medal,
              },
              {
                name: "Safety Champion",
                desc: "50 verified reports",
                icon: Trophy,
              },
            ].map(({ name, desc, icon: Icon }) => (
              <div
                key={name}
                className={
                  "achievement " +
                  (q.data?.badges.includes(name) ? "earned" : "")
                }
              >
                <span>
                  <Icon size={31} />
                </span>
                <h3>{name}</h3>
                <p>{desc}</p>
                <small>
                  {q.data?.badges.includes(name)
                    ? "Earned"
                    : "Keep contributing"}
                </small>
              </div>
            ))}
          </div>
          <div className="rewards-rules">
            <h3>How points work</h3>
            <p>
              <b>+10</b> for a submitted report · <b>+20</b> when verified ·{" "}
              <b>+5</b> for an independent confirmation of a verified hazard.
              Rejected reports reverse their rewards.
            </p>
          </div>
        </Panel>
        <Panel
          title="Community champions"
          subtitle="Contributors who chose to appear publicly"
        >
          {leaders.error ? (
            <ErrorState error={leaders.error} />
          ) : leaders.data?.length ? (
            <div className="leaderboard">
              {leaders.data.map((l, i) => (
                <div key={i}>
                  <span className={"rank rank-" + i}>{i + 1}</span>
                  <span className="avatar small">{l.name.charAt(0)}</span>
                  <div>
                    <strong>{l.name}</strong>
                    <small>{l.verified} verified reports</small>
                  </div>
                  <b>
                    {l.points}
                    <small>points</small>
                  </b>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Be an early contributor"
              text="Opt in from settings to join the leaderboard."
            />
          )}
          <Link className="leaderboard-settings" to="/settings">
            Manage your leaderboard visibility →
          </Link>
        </Panel>
      </div>
      <Panel
        title="Your contribution history"
        subtitle="Points are awarded and stored by the backend"
      >
        {history.data?.length ? (
          <div className="points-history">
            {history.data.map((h) => (
              <Link to={"/reports/" + h.reportId} key={h.id}>
                <span className="small-icon">
                  <Award size={19} />
                </span>
                <div>
                  <strong>{label(h.reason)}</strong>
                  <small>{date(h.createdAt)}</small>
                </div>
                <b className={h.points > 0 ? "positive" : "negative"}>
                  {h.points > 0 ? "+" : ""}
                  {h.points}
                </b>
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            title="Your impact begins with a report"
            text="Contribution points will appear here after your first submission."
          />
        )}
      </Panel>
    </>
  );
}
