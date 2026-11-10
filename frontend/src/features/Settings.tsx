import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  LockKeyhole,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { api, patch, post } from "../lib/api";
import { useAuth, useToast } from "../app/context";
import { ErrorState, Field, PageHeading, Panel } from "../components/ui";
export default function Settings() {
  const { user, reload, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    name: user?.name || "",
    publicDisplayName: user?.publicDisplayName || "",
    leaderboardOptIn: user?.leaderboardOptIn || false,
    notificationsEnabled: user?.notificationsEnabled ?? true,
  });
  const [password, setPassword] = useState({
    currentPassword: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title="Your profile. Your preferences."
        description="Choose how you appear and what you hear about."
      />
      {error != null && <ErrorState error={error} />}
      <div className="settings-layout">
        <Panel
          title="Profile details"
          subtitle="Your email is never shown on public reports"
          action={<UserRound size={21} />}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await patch("/users/me", profile);
                await reload();
                toast("Profile saved.");
              });
            }}
          >
            <Field label="Full name">
              <input
                required
                maxLength={100}
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
              />
            </Field>
            <Field label="Email address">
              <input value={user?.email || ""} disabled />
            </Field>
            <Field
              label="Public display name"
              hint="Used only if you opt into the community leaderboard."
            >
              <input
                required
                maxLength={100}
                value={profile.publicDisplayName}
                onChange={(e) =>
                  setProfile({ ...profile, publicDisplayName: e.target.value })
                }
              />
            </Field>
            <div className="setting-switch">
              <div>
                <strong>Join the public leaderboard</strong>
                <p>Show your display name and contribution points.</p>
              </div>
              <input
                aria-label="Join public leaderboard"
                type="checkbox"
                checked={profile.leaderboardOptIn}
                onChange={(e) =>
                  setProfile({ ...profile, leaderboardOptIn: e.target.checked })
                }
              />
            </div>
            <div className="setting-switch">
              <div>
                <strong>Report notifications</strong>
                <p>Receive future updates in your notification center.</p>
              </div>
              <input
                aria-label="Enable report notifications"
                type="checkbox"
                checked={profile.notificationsEnabled}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    notificationsEnabled: e.target.checked,
                  })
                }
              />
            </div>
            <button className="button primary" disabled={busy}>
              <Save size={17} />
              Save preferences
            </button>
          </form>
        </Panel>
        <div>
          <Panel
            title="Change password"
            subtitle="Changing it signs you out on all devices"
            action={<LockKeyhole size={21} />}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await post("/users/me/password", password);
                  await logout();
                  navigate("/login");
                  toast("Password changed. Sign in again.");
                });
              }}
            >
              <Field label="Current password">
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  value={password.currentPassword}
                  onChange={(e) =>
                    setPassword({
                      ...password,
                      currentPassword: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="New password" hint="Use at least 10 characters.">
                <input
                  required
                  minLength={10}
                  maxLength={72}
                  type="password"
                  autoComplete="new-password"
                  value={password.password}
                  onChange={(e) =>
                    setPassword({ ...password, password: e.target.value })
                  }
                />
              </Field>
              <button disabled={busy} className="button secondary">
                Update password
              </button>
            </form>
          </Panel>
          <Panel
            title="Your location stays yours"
            action={<ShieldCheck size={21} />}
          >
            <p className="muted">
              Location is collected only when you request GPS or start
              monitoring. Raw motion telemetry expires after seven days. Private
              journey data is never placed on the public map.
            </p>
            <button
              disabled={busy}
              className="text-button"
              onClick={() =>
                run(async () => {
                  await api("/telemetry/me", { method: "DELETE" });
                  toast("Raw telemetry deleted.");
                })
              }
            >
              Delete my raw telemetry
            </button>
          </Panel>
          <Panel title="Delete your account">
            <p className="muted">
              This deactivates your account, removes private monitoring data,
              and anonymizes your profile. Public civic reports and audit
              records remain for accountability.
            </p>
            <button
              disabled={busy}
              className="button danger-outline"
              onClick={() => {
                if (
                  window.confirm(
                    "Delete your RoadSaathi account and private journey data? Public reports remain anonymized.",
                  )
                )
                  void run(async () => {
                    await api("/telemetry/me", { method: "DELETE" });
                    await api("/users/me", { method: "DELETE" });
                    await logout();
                    navigate("/");
                  });
              }}
            >
              <Trash2 size={16} />
              Delete account
            </button>
          </Panel>
        </div>
      </div>
    </>
  );
}
