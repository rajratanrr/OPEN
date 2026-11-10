import express from "express";
import helmet from "helmet";
import { createProxyMiddleware } from "http-proxy-middleware";
import { MongoClient } from "mongodb";
import { telemetrySchema, withinSession } from "./validation.js";

const app = express();
const backend = process.env.BACKEND_URL || "http://127.0.0.1:8080";
const mongo = new MongoClient(
  process.env.MONGODB_URI || "mongodb://127.0.0.1:57017/roadsaathi",
  { serverSelectionTimeoutMS: 2000 },
);
let samples;
async function collection() {
  if (!samples) {
    await mongo.connect();
    samples = mongo.db().collection("motion_samples");
    await samples.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await samples.createIndex(
      { userId: 1, sessionId: 1, id: 1 },
      { unique: true },
    );
    await samples.createIndex({ userId: 1, sessionId: 1, recordedAt: -1 });
  }
  return samples;
}
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
  }),
);
async function authorize(req, res, next) {
  try {
    const r = await fetch(`${backend}/api/v1/auth/me`, {
      headers: { cookie: req.headers.cookie || "" },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok)
      return res
        .status(r.status)
        .json({ message: "Please sign in to continue" });
    req.user = await r.json();
    next();
  } catch {
    res.status(503).json({ message: "Authentication service unavailable" });
  }
}
const allowedOrigins = new Set(
  (
    process.env.ALLOWED_ORIGINS ||
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
  ).split(","),
);
app.use(
  "/api/v1/telemetry",
  (req, res, next) => {
    const origin = req.get("Origin");
    if (origin && allowedOrigins.has(origin)) {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Access-Control-Allow-Credentials", "true");
      res.set("Vary", "Origin");
      res.set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type,X-Roadsaathi");
    }
    if (req.method === "OPTIONS")
      return res.sendStatus(origin && !allowedOrigins.has(origin) ? 403 : 204);
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (req.get("X-Roadsaathi") !== "1" ||
        (req.get("Origin") && !allowedOrigins.has(req.get("Origin"))))
    )
      return res
        .status(403)
        .json({ message: "Request origin could not be verified" });
    next();
  },
  express.json({ limit: "256kb" }),
  authorize,
);
app.get("/api/v1/telemetry/health", async (req, res) => {
  try {
    await collection();
    res.json({ status: "UP", retentionDays: 7 });
  } catch {
    res.status(503).json({
      status: "UNAVAILABLE",
      message:
        "Telemetry storage is unavailable. Core reporting remains available.",
    });
  }
});
app.post("/api/v1/telemetry/samples", async (req, res) => {
  const parsed = telemetrySchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid sensor samples" });
  const { sessionId, samples: batch } = parsed.data;
  try {
    const sessionResponse = await fetch(
      `${backend}/api/v1/monitoring/sessions/${sessionId}`,
      {
        headers: { cookie: req.headers.cookie || "" },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!sessionResponse.ok)
      return res.status(sessionResponse.status).json({
        message: "Session is unavailable or belongs to another account",
      });
    const session = await sessionResponse.json();
    const now = Date.now();
    if (batch.some((s) => !withinSession(s.recordedAt, session, now)))
      return res.status(400).json({
        message:
          "Samples must be recorded during this session and within seven days",
      });
    const col = await collection();
    const result = await col.bulkWrite(
      batch.map((s) => ({
        updateOne: {
          filter: { userId: req.user.id, sessionId, id: s.id },
          update: {
            $setOnInsert: {
              ...s,
              userId: req.user.id,
              sessionId,
              recordedAt: new Date(s.recordedAt),
              expiresAt: new Date(Date.parse(s.recordedAt) + 7 * 86400000),
            },
          },
          upsert: true,
        },
      })),
    );
    res.status(201).json({ stored: result.upsertedCount });
  } catch {
    res.status(503).json({
      message:
        "Telemetry storage unavailable. Samples have not been acknowledged.",
    });
  }
});
app.get("/api/v1/telemetry/sessions/:id", async (req, res) => {
  try {
    const col = await collection();
    res.json(
      await col
        .find(
          { userId: req.user.id, sessionId: req.params.id },
          { projection: { _id: 0, userId: 0 } },
        )
        .sort({ recordedAt: -1 })
        .limit(300)
        .toArray(),
    );
  } catch {
    res.status(503).json({ message: "Telemetry storage unavailable" });
  }
});
app.delete("/api/v1/telemetry/me", async (req, res) => {
  try {
    const col = await collection();
    await col.deleteMany({ userId: req.user.id });
    res.json({ success: true });
  } catch {
    res.status(503).json({
      message:
        "Telemetry deletion unavailable. Try again before deleting the account.",
    });
  }
});
app.use(
  createProxyMiddleware({
    target: backend,
    changeOrigin: true,
    pathFilter: (path) =>
      ["/api/", "/actuator/", "/swagger-ui", "/v3/"].some((prefix) =>
        path.startsWith(prefix),
      ),
    proxyTimeout: 0,
    on: {
      error: (error, req, res) => {
        if ("writeHead" in res && !res.headersSent) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ message: "RoadSaathi backend is unavailable" }),
          );
        }
      },
    },
  }),
);
app.get("/health", (req, res) =>
  res.json({ status: "UP", service: "roadsaathi-gateway" }),
);
app.use((error, req, res, next) =>
  res
    .status(error.status || 500)
    .json({ message: "Request could not be processed" }),
);
const server = app.listen(
  Number(process.env.GATEWAY_PORT || 3000),
  process.env.GATEWAY_HOST || "127.0.0.1",
  () =>
    console.log(
      "RoadSaathi gateway: http://127.0.0.1:" +
        (process.env.GATEWAY_PORT || 3000),
    ),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    server.close();
    mongo.close().finally(() => process.exit(0));
  });
