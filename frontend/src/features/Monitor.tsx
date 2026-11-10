import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Clock3,
  Crosshair,
  LocateFixed,
  Pause,
  Play,
  Radio,
  ShieldCheck,
  Smartphone,
  Volume2,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Capacitor } from "@capacitor/core";
import { newId } from "../lib/id";
import { getLocation, watchLocation, listenMotion } from "../lib/device";
import type { LocationFix } from "../lib/device";
import { api, patch, post, queryString } from "../lib/api";
import { BumpDetector, distanceMeters } from "../lib/sensors";
import type { Position } from "../lib/sensors";
import { queueSensor, syncSensorQueue } from "../lib/sensorQueue";
import { useAuth, useConfig, useOnline, useToast } from "../app/context";
import {
  Empty,
  ErrorState,
  PageHeading,
  Panel,
  StatCard,
} from "../components/ui";
import { HazardMap } from "../components/HazardMap";
import type { MonitoringSession, Page, RoadReport } from "../types";
import { date, label } from "../types";
export default function Monitor() {
  const { user } = useAuth();
  const { data: config } = useConfig();
  const online = useOnline();
  const client = useQueryClient();
  const toast = useToast();
  const [active, setActive] = useState(false),
    [starting, setStarting] = useState(false),
    [stopping, setStopping] = useState(false),
    [error, setError] = useState<unknown>(),
    [position, setPosition] = useState<Position | null>(null),
    [elapsed, setElapsed] = useState(0),
    [count, setCount] = useState(0),
    [chart, setChart] = useState<{ time: string; impact: number }[]>([]),
    [audio, setAudio] = useState(false),
    [calibrated, setCalibrated] = useState(false),
    [hazard, setHazard] = useState<{
      report: RoadReport;
      distance: number;
    } | null>(null);
  const session = useRef<MonitoringSession | null>(null),
    gps = useRef<Position | null>(null),
    cleanup = useRef<() => void>(() => {}),
    samples = useRef<unknown[]>([]),
    events = useRef<unknown[]>([]),
    audioRef = useRef(false),
    lastAlertQuery = useRef(0),
    cooldowns = useRef(new Map<string, number>());
  const supported =
    Capacitor.isNativePlatform() || "DeviceMotionEvent" in window;
  const history = useQuery({
    queryKey: ["monitoring-sessions"],
    queryFn: () => api<MonitoringSession[]>("/monitoring/sessions"),
  });
  const flush = async () => {
    const s = session.current;
    if (!s || !user) return;
    const batch = samples.current.splice(0),
      bumps = events.current.splice(0);
    if (batch.length)
      await queueSensor(user.id, s.id, "telemetry", {
        sessionId: s.id,
        samples: batch,
      });
    if (bumps.length)
      await queueSensor(user.id, s.id, "events", { events: bumps });
    if (navigator.onLine) void syncSensorQueue(user.id);
  };
  const stop = async () => {
    setStopping(true);
    cleanup.current();
    cleanup.current = () => {};
    setActive(false);
    setStarting(false);
    setHazard(null);
    try {
      if (session.current && user) {
        const id = session.current.id;
        await flush();
        await queueSensor(user.id, id, "stop", {});
        session.current = null;
        if (navigator.onLine) await syncSensorQueue(user.id);
        await client.invalidateQueries({ queryKey: ["monitoring-sessions"] });
      }
    } finally {
      setStopping(false);
    }
  };
  useEffect(() => {
    audioRef.current = audio;
  }, [audio]);
  useEffect(() => {
    if (online && user) void syncSensorQueue(user.id);
  }, [online, user?.id]);
  useEffect(() => {
    return () => {
      cleanup.current();
      if (session.current && user) {
        const s = session.current;
        const batch = samples.current.splice(0),
          bumps = events.current.splice(0);
        void (async () => {
          if (batch.length)
            await queueSensor(user.id, s.id, "telemetry", {
              sessionId: s.id,
              samples: batch,
            });
          if (bumps.length)
            await queueSensor(user.id, s.id, "events", { events: bumps });
          await queueSensor(user.id, s.id, "stop", {});
          if (navigator.onLine) await syncSensorQueue(user.id);
        })();
      }
    };
  }, [user?.id]);
  const alertFor = async (p: Position) => {
    if (p.accuracy > 50 || Date.now() - lastAlertQuery.current < 5000) return;
    lastAlertQuery.current = Date.now();
    try {
      const radius = Math.min(
        1000,
        Math.max(
          config?.detection.alertRadiusMeters || 150,
          (p.speed || 0) * 8,
        ),
      );
      const found = await api<Page<RoadReport>>(
        "/hazards/nearby?" +
          queryString({ latitude: p.latitude, longitude: p.longitude, radius }),
      );
      if (!session.current) return;
      const near = found.items
        .map((r) => ({ report: r, distance: distanceMeters(p, r) }))
        .sort((a, b) => a.distance - b.distance)
        .find(
          (h) =>
            Date.now() - (cooldowns.current.get(h.report.id) || 0) > 120000,
        );
      if (near) {
        cooldowns.current.set(near.report.id, Date.now());
        setHazard(near);
        if (audioRef.current && "speechSynthesis" in window) {
          const speech = new SpeechSynthesisUtterance(
            "Reported road damage nearby. Stay alert.",
          );
          speech.lang = "en-IN";
          window.speechSynthesis.speak(speech);
        }
      }
    } catch {
      /* The next location update retries. */
    }
  };
  const start = async () => {
    setError(undefined);
    setStarting(true);
    setCount(0);
    setChart([]);
    setCalibrated(false);
    const detector = new BumpDetector(config?.detection.bumpThreshold || 8);
    let removeGps: (() => void) | undefined,
      timer: ReturnType<typeof setInterval> | undefined,
      noData: ReturnType<typeof setTimeout> | undefined,
      removeMotion: (() => void) | undefined;
    const visibility = () => {
      if (document.hidden) {
        void stop();
        toast("Monitoring stopped because the app moved to the background.");
      }
    };
    const clear = () => {
      removeGps?.();
      if (timer) clearInterval(timer);
      if (noData) clearTimeout(noData);
      removeMotion?.();
      document.removeEventListener("visibilitychange", visibility);
    };
    cleanup.current = clear;
    try {
      if (!supported)
        throw new Error(
          "Motion sensors are unavailable on this device. Use a supported phone in the foreground.",
        );
      const DM = window.DeviceMotionEvent as typeof DeviceMotionEvent & {
        requestPermission?: () => Promise<string>;
      };
      if (DM?.requestPermission && (await DM.requestPermission()) !== "granted")
        throw new Error("Motion permission was not granted.");
      const fix = await getLocation();
      const update = (p: LocationFix) => {
        gps.current = {
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
          speed: p.coords.speed,
          timestamp: p.timestamp,
        };
        setPosition(gps.current);
        void alertFor(gps.current);
      };
      session.current = await post<MonitoringSession>("/monitoring/sessions");
      update(fix);
      const started = Date.now();
      let lastUi = 0,
        lastStored = 0,
        received = false;
      const reading = (
        e: Pick<
          DeviceMotionEvent,
          "acceleration" | "accelerationIncludingGravity"
        >,
      ) => {
        const a =
          e.acceleration?.x !== null && e.acceleration?.x !== undefined
            ? e.acceleration
            : e.accelerationIncludingGravity;
        if (!a || a.x === null || a.y === null || a.z === null) return;
        received = true;
        const magnitude =
          e.acceleration?.x !== null && e.acceleration?.x !== undefined
            ? Math.hypot(a.x, a.y, a.z)
            : Math.abs(Math.hypot(a.x, a.y, a.z) - 9.80665);
        const now = Date.now();
        const sample = detector.sample(magnitude, now, gps.current);
        setCalibrated(sample.calibrated);
        if (now - lastUi > 100) {
          lastUi = now;
          setChart((old) => [
            ...old.slice(-59),
            {
              time: new Date(now).toLocaleTimeString(),
              impact: Number(sample.magnitude.toFixed(2)),
            },
          ]);
        }
        const p = gps.current;
        if (
          p &&
          now - p.timestamp < 5000 &&
          now - lastStored >= 1000 &&
          sample.jerk <= 2000
        ) {
          lastStored = now;
          samples.current.push({
            id: newId(),
            recordedAt: new Date(now).toISOString(),
            magnitude,
            jerk: sample.jerk,
            latitude: p.latitude,
            longitude: p.longitude,
            speed: p.speed,
            accuracy: p.accuracy,
          });
        }
        if (sample.event && p) {
          events.current.push({
            id: newId(),
            recordedAt: new Date(now).toISOString(),
            latitude: p.latitude,
            longitude: p.longitude,
            accelerationMagnitude: magnitude,
            jerk: sample.jerk,
            estimatedSpeed: p.speed,
            gpsAccuracy: p.accuracy,
          });
          setCount((c) => c + 1);
        }
      };
      removeMotion = await listenMotion(reading, () => {
        void stop();
        toast("Monitoring stopped because the app moved to the background.");
      });
      removeGps = await watchLocation(update, () => {
        setError(
          new Error(
            "GPS signal was lost. Events need a fresh accurate position.",
          ),
        );
        gps.current = null;
      });
      noData = setTimeout(() => {
        if (!received) {
          setError(
            new Error(
              "No motion readings were received. Monitoring has stopped. Try a supported phone with sensor permissions enabled.",
            ),
          );
          void stop();
        }
      }, 6000);
      timer = setInterval(() => {
        setElapsed(Math.floor((Date.now() - started) / 1000));
        if (samples.current.length >= 20 || events.current.length) void flush();
      }, 1000);
      document.addEventListener("visibilitychange", visibility);
      setActive(true);
      setStarting(false);
    } catch (e) {
      clear();
      setStarting(false);
      setError(
        e instanceof Error
          ? e
          : new Error("Device permissions could not be obtained."),
      );
      if (session.current) await stop();
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="LET THE ROAD SPEAK"
        title="A little more awareness."
        description="Foreground road monitoring with real motion sensors and location data."
        action={
          <span className={"monitor-status " + (active ? "running" : "")}>
            <span />
            {active ? "Monitoring active" : "Monitoring paused"}
          </span>
        }
      />
      <div className="notice safety-notice">
        <ShieldCheck size={21} />
        <p>
          <strong>Set up before your journey.</strong> Operate as a passenger or
          while safely parked. Keep the phone secured. Never interact with it
          while driving.
        </p>
      </div>
      {error != null && <ErrorState error={error} />}
      <div className="monitor-grid">
        <Panel
          title="Your road companion"
          subtitle="Real readings. Careful interpretation."
          className="monitor-control"
        >
          <div className={"sensor-orbit " + (active ? "active" : "")}>
            <Activity size={48} />
          </div>
          <h2>{active ? "Listening to the road." : "Ready when you are."}</h2>
          <p>
            {active
              ? calibrated
                ? "Sensor calibrated. Possible impacts remain unverified."
                : "Calibrating with the first 30 readings…"
              : supported
                ? "Enable motion and location permissions to begin."
                : "Motion sensing is not available on this device."}
          </p>
          <button
            className={
              "button " + (active ? "danger-outline" : "primary") + " full"
            }
            disabled={
              starting || stopping || (!active && (!supported || !online))
            }
            onClick={() => void (active ? stop() : start())}
          >
            {active ? <Pause size={19} /> : <Play size={19} />}{" "}
            {stopping
              ? "Saving session…"
              : starting
                ? "Requesting permissions…"
                : active
                  ? "Stop monitoring"
                  : "Start monitoring"}
          </button>
          <label className="check-label audio-toggle">
            <input
              type="checkbox"
              checked={audio}
              onChange={(e) => setAudio(e.target.checked)}
            />
            <Volume2 size={17} />
            Enable spoken proximity alerts
          </label>
          <div className="device-notes">
            <span>
              <Smartphone size={15} />
              Foreground only
            </span>
            <span>
              <LocateFixed size={15} />
              Location by permission
            </span>
          </div>
        </Panel>
        <div>
          <div className="stat-grid monitor-stats">
            <StatCard
              title="Duration"
              value={
                String(Math.floor(elapsed / 60)).padStart(2, "0") +
                ":" +
                String(elapsed % 60).padStart(2, "0")
              }
              icon={<Clock3 size={20} />}
            />
            <StatCard
              title="Possible bumps"
              value={count}
              icon={<Activity size={20} />}
              color="orange"
            />
            <StatCard
              title="Speed"
              value={
                position?.speed != null
                  ? Math.round(position.speed * 3.6) + " km/h"
                  : "—"
              }
              icon={<Radio size={20} />}
            />
            <StatCard
              title="GPS accuracy"
              value={position ? `±${Math.round(position.accuracy)} m` : "—"}
              icon={<Crosshair size={20} />}
            />
          </div>
          <Panel
            title="Motion signal"
            subtitle="Filtered acceleration magnitude · m/s²"
          >
            <div className="sensor-chart">
              {chart.length ? (
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={chart}>
                    <CartesianGrid stroke="#edf1f0" vertical={false} />
                    <XAxis dataKey="time" hide />
                    <YAxis width={35} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="impact"
                      stroke="#0c9478"
                      fill="#e0f2eb"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Empty
                  title="Waiting for sensor readings"
                  text="No simulated data. Your phone’s actual motion will appear here."
                />
              )}
            </div>
          </Panel>
        </div>
      </div>
      {hazard && (
        <div className="hazard-alert" role="alert">
          <AlertTriangle size={28} />
          <div>
            <h3>Reported road damage nearby.</h3>
            <p>
              {Math.round(hazard.distance)} m · {label(hazard.report.severity)}{" "}
              · {hazard.report.roadName}
            </p>
            <small>
              Straight-line distance. Your road segment has not been matched.
            </small>
          </div>
        </div>
      )}
      <div className="dashboard-grid">
        <Panel
          title="Journey location"
          subtitle="Only collected while monitoring is enabled"
        >
          <HazardMap
            height={280}
            selected={
              position ? [position.latitude, position.longitude] : undefined
            }
            focus={
              position ? [position.latitude, position.longitude] : undefined
            }
          />
        </Panel>
        <Panel title="Monitoring history" subtitle="Private to your account">
          {history.data?.length ? (
            <div className="session-list">
              {history.data.map((s) => (
                <div key={s.id}>
                  <span className="small-icon">
                    <Activity size={19} />
                  </span>
                  <div>
                    <strong>{date(s.startedAt)}</strong>
                    <small>
                      {s.eventCount || 0} unverified events · {label(s.status)}
                    </small>
                  </div>
                  {s.status === "ACTIVE" && !active && (
                    <button
                      className="text-button"
                      onClick={async () => {
                        try {
                          await patch("/monitoring/sessions/" + s.id + "/stop");
                          void history.refetch();
                        } catch (e) {
                          toast((e as Error).message, true);
                        }
                      }}
                    >
                      Close session
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Your first journey is ahead"
              text="Completed monitoring sessions will appear here."
            />
          )}
        </Panel>
      </div>
      <p className="muted">
        Phone movement, braking, and speed breakers can resemble road impacts.
        Sensor events are possible bumps, never automatically verified potholes.
        Raw telemetry expires after seven days.
      </p>
    </>
  );
}
