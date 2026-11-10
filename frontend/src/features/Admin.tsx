import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Save, ShieldCheck, Users } from "lucide-react";
import { api, patch, post } from "../lib/api";
import { useAuth, useToast } from "../app/context";
import {
  Empty,
  ErrorState,
  Field,
  PageHeading,
  Panel,
  Spinner,
} from "../components/ui";
import type { Role } from "../types";
import { date, label } from "../types";
type Account = {
  id: string;
  name: string;
  email: string;
  role: Role;
  organizationId: string | null;
  active: boolean;
};
type Org = { id: string; name: string };
function UserRow({
  u,
  orgs,
  save,
  disabled,
}: {
  u: Account;
  orgs: Org[];
  save: (u: Account) => Promise<void>;
  disabled: boolean;
}) {
  const [edit, setEdit] = useState(u),
    [busy, setBusy] = useState(false);
  return (
    <tr>
      <td>
        <strong>{u.name}</strong>
        <small className="block">{u.email}</small>
      </td>
      <td>
        <select
          aria-label={"Role for " + u.name}
          disabled={disabled}
          value={edit.role}
          onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}
        >
          {["CITIZEN", "MUNICIPAL_OFFICER", "SUPER_ADMIN"].map((r) => (
            <option key={r} value={r}>
              {label(r)}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          aria-label={"Jurisdiction for " + u.name}
          disabled={disabled || edit.role !== "MUNICIPAL_OFFICER"}
          value={edit.organizationId || ""}
          onChange={(e) =>
            setEdit({ ...edit, organizationId: e.target.value || null })
          }
        >
          <option value="">Choose jurisdiction</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input
          aria-label={"Active account " + u.name}
          type="checkbox"
          checked={edit.active}
          disabled={disabled}
          onChange={(e) => setEdit({ ...edit, active: e.target.checked })}
        />
      </td>
      <td>
        <button
          className="button secondary small-button"
          disabled={busy || disabled}
          onClick={async () => {
            setBusy(true);
            await save(edit);
            setBusy(false);
          }}
        >
          Save
        </button>
      </td>
    </tr>
  );
}
export default function Admin() {
  const client = useQueryClient();
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("users"),
    [page, setPage] = useState(0),
    [error, setError] = useState<unknown>(),
    [newOrg, setNewOrg] = useState({
      name: "",
      south: 30.8,
      north: 31,
      west: 75.75,
      east: 76,
    });
  const users = useQuery({
    queryKey: ["admin-users", page],
    queryFn: () => api<Account[]>("/admin/users?page=" + page),
  });
  const orgs = useQuery({
    queryKey: ["admin-orgs"],
    queryFn: () => api<Org[]>("/admin/organizations"),
  });
  const logs = useQuery({
    queryKey: ["admin-audit", page],
    queryFn: () =>
      api<
        {
          id: string;
          action: string;
          actor: string;
          entityType: string;
          createdAt: string;
        }[]
      >("/admin/audit-logs?page=" + page),
    enabled: tab === "audit",
  });
  const health = useQuery({
    queryKey: ["admin-health"],
    queryFn: () =>
      api<{ database: string; reports: number; users: number }>(
        "/admin/system-health",
      ),
  });
  const [settings, setSettings] = useState({
    duplicateRadiusMeters: 20,
    alertRadiusMeters: 150,
    bumpThreshold: 8,
  });
  useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const s = await api<typeof settings>("/admin/settings");
      setSettings(s);
      return s;
    },
  });
  const save = async (u: Account) => {
    setError(undefined);
    try {
      await patch("/admin/users/" + u.id + "/role", {
        role: u.role,
        organizationId: u.organizationId,
        active: u.active,
      });
      await client.invalidateQueries({ queryKey: ["admin-users"] });
      toast("Account access updated. Existing sessions were revoked.");
    } catch (e) {
      setError(e);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="PLATFORM ADMINISTRATION"
        title="A trusted foundation."
        description="Manage account access, city jurisdictions, and detection settings."
        action={
          <span className="city-pill">
            <span className="live-dot" />
            Database {health.data?.database || "checking"}
          </span>
        }
      />
      <div className="tabs">
        {["users", "organizations", "settings", "audit"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => {
              setTab(t);
              setPage(0);
            }}
          >
            {label(t)}
          </button>
        ))}
      </div>
      {error != null && <ErrorState error={error} />}
      <Panel>
        {tab === "users" &&
          (users.isPending ? (
            <Spinner />
          ) : users.error ? (
            <ErrorState error={users.error} />
          ) : (
            <>
              <div className="panel-heading">
                <div>
                  <h2>People & permissions</h2>
                  <p>
                    Officer access requires a jurisdiction. Your own access must
                    be changed by another administrator.
                  </p>
                </div>
              </div>
              <div className="report-table-scroll">
                <table className="report-table admin-table">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Role</th>
                      <th>Jurisdiction</th>
                      <th>Active</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {users.data?.map((u) => (
                      <UserRow
                        key={u.id}
                        u={u}
                        orgs={orgs.data || []}
                        save={save}
                        disabled={u.id === user?.id}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ))}
        {tab === "organizations" && (
          <div className="admin-org-grid">
            <div>
              <h2>Configured jurisdictions</h2>
              {orgs.data?.map((o) => (
                <div className="org-card" key={o.id}>
                  <Building2 size={23} />
                  <div>
                    <strong>{o.name}</strong>
                    <small>{o.id}</small>
                  </div>
                </div>
              ))}
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await post("/admin/organizations", newOrg);
                  await orgs.refetch();
                  setNewOrg({ ...newOrg, name: "" });
                  toast("Jurisdiction created.");
                } catch (e) {
                  setError(e);
                }
              }}
            >
              <h2>Add jurisdiction</h2>
              <p className="muted">
                This creates a rectangular service boundary. Use reviewed
                municipal boundary data before public launch.
              </p>
              <Field label="Organization name">
                <input
                  required
                  maxLength={160}
                  value={newOrg.name}
                  onChange={(e) =>
                    setNewOrg({ ...newOrg, name: e.target.value })
                  }
                />
              </Field>
              <div className="form-grid">
                {(["south", "north", "west", "east"] as const).map((k) => (
                  <Field key={k} label={label(k)}>
                    <input
                      required
                      type="number"
                      step="any"
                      value={newOrg[k]}
                      onChange={(e) =>
                        setNewOrg({ ...newOrg, [k]: Number(e.target.value) })
                      }
                    />
                  </Field>
                ))}
              </div>
              <button className="button primary">
                <Plus size={17} />
                Create jurisdiction
              </button>
            </form>
          </div>
        )}
        {tab === "settings" && (
          <form
            className="admin-settings"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/admin/settings", {
                  method: "PUT",
                  body: JSON.stringify(settings),
                });
                await client.invalidateQueries({ queryKey: ["config"] });
                toast("Detection settings saved.");
              } catch (e) {
                setError(e);
              }
            }}
          >
            <h2>Detection parameters</h2>
            <p className="muted">
              Sensor events remain unverified regardless of thresholds.
            </p>
            <Field label="Duplicate search radius (meters)">
              <input
                type="number"
                min={5}
                max={100}
                required
                value={settings.duplicateRadiusMeters}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    duplicateRadiusMeters: Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Proximity alert radius (meters)">
              <input
                type="number"
                min={30}
                max={1000}
                required
                value={settings.alertRadiusMeters}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    alertRadiusMeters: Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Bump threshold (m/s²)">
              <input
                type="number"
                step="0.1"
                min={3}
                max={20}
                required
                value={settings.bumpThreshold}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    bumpThreshold: Number(e.target.value),
                  })
                }
              />
            </Field>
            <button className="button primary">
              <Save size={17} />
              Save settings
            </button>
          </form>
        )}
        {tab === "audit" &&
          (logs.isPending ? (
            <Spinner />
          ) : logs.error ? (
            <ErrorState error={logs.error} />
          ) : (
            <div className="report-table-scroll">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Entity</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.data?.map((l) => (
                    <tr key={l.id}>
                      <td>{label(l.action)}</td>
                      <td>{l.actor}</td>
                      <td>{label(l.entityType)}</td>
                      <td>{new Date(l.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </Panel>
      {["users", "audit"].includes(tab) && (
        <div className="pagination">
          <span>Page {page + 1}</span>
          <div className="row">
            <button
              className="button secondary small-button"
              disabled={!page}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <button
              className="button secondary small-button"
              disabled={
                (tab === "users" ? users.data : logs.data)?.length !== 50
              }
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}
