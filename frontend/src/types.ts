export type Role = "CITIZEN" | "MUNICIPAL_OFFICER" | "SUPER_ADMIN";
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  organizationId: string | null;
  publicDisplayName: string;
  leaderboardOptIn: boolean;
  notificationsEnabled: boolean;
}
export type Status =
  | "PENDING_REVIEW"
  | "VERIFIED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "REJECTED";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";
export type Damage =
  | "POTHOLE"
  | "CRACK"
  | "SURFACE_DAMAGE"
  | "WATERLOGGING"
  | "OTHER_HAZARD"
  | "NO_VISIBLE_DAMAGE"
  | "UNCERTAIN";
export interface AnalysisResult {
  road_damage_detected: boolean;
  damage_type: Damage;
  severity: Severity;
  confidence_level: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  visible_risk_factors: string[];
  requires_human_review: boolean;
}
export interface Analysis {
  id: string;
  status: string;
  result: AnalysisResult | null;
  message: string;
}
export interface RoadReport {
  id: string;
  roadName: string;
  description: string;
  latitude: number;
  longitude: number;
  gpsAccuracyMeters: number | null;
  damageType: Damage;
  severity: Severity;
  status: Status;
  evidenceId: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  assignedTo: string | null;
  assignedOfficer: string | null;
  priority: string | null;
  dueDate: string | null;
  organizationName: string;
  confirmations: number;
  aiStatus: string;
  isOwner?: boolean;
  canManage?: boolean;
  isConfirmed?: boolean;
  history?: {
    id: string;
    previousStatus: Status | null;
    newStatus: Status;
    reason: string;
    changedAt: string;
  }[];
  repairEvidence?: {
    id: string;
    evidenceId: string;
    notes: string;
    createdAt: string;
  }[];
  aiAnalysis?: Analysis;
  internalNotes?: {
    id: string;
    note: string;
    author: string;
    createdAt: string;
  }[];
  priorityExplanation?: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface Config {
  aiEnabled: boolean;
  demoMode: boolean;
  mailEnabled: boolean;
  city: string;
  center: [number, number];
  detection: {
    duplicateRadiusMeters: number;
    alertRadiusMeters: number;
    bumpThreshold: number;
  };
}
export interface Summary {
  total: number;
  verified: number;
  resolved: number;
  contributors: number;
  demoReports: number;
}
export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  reportId: string;
  isRead: boolean;
  createdAt: string;
}
export interface Stats {
  total: number;
  verified: number;
  resolved: number;
  points: number;
}
export interface Series {
  name: string;
  value: number;
}
export interface MunicipalSummary {
  total: number;
  pending: number;
  verified: number;
  critical: number;
  assigned: number;
  inProgress: number;
  resolved: number;
  averageResolutionDays: number | null;
  byStatus: Series[];
  bySeverity: Series[];
  byDamage: Series[];
  trends: { name: string; reports: number; resolved: number }[];
  hotspots: {
    latitude: number;
    longitude: number;
    count: number;
    critical: number;
  }[];
}
export interface MonitoringSession {
  id: string;
  startedAt: string;
  endedAt?: string;
  status: string;
  eventCount?: number;
}
export interface ReportInput {
  clientRequestId: string;
  roadName: string;
  description: string;
  latitude: number;
  longitude: number;
  gpsAccuracyMeters: number | null;
  damageType: Damage;
  severity: Severity;
  evidenceId: string;
  aiAnalysisId: string | null;
}
export const statuses: Status[] = [
  "PENDING_REVIEW",
  "VERIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
];
export const severities: Severity[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
  "UNKNOWN",
];
export const damages: Damage[] = [
  "POTHOLE",
  "CRACK",
  "SURFACE_DAMAGE",
  "WATERLOGGING",
  "OTHER_HAZARD",
  "NO_VISIBLE_DAMAGE",
  "UNCERTAIN",
];
export const label = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (s) => s.toUpperCase());
export const date = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export const imageUrl = (id: string) =>
  `${import.meta.env.VITE_API_BASE_URL || ""}/api/v1/evidence/${id}`;
