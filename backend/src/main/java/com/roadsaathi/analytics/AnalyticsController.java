package com.roadsaathi.analytics;

import com.roadsaathi.common.Db;
import com.roadsaathi.security.Identity;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/analytics")
public class AnalyticsController {
  private final Db db;
  private final Identity identity;

  public AnalyticsController(Db d, Identity i) {
    db = d;
    identity = i;
  }

  @GetMapping("/public-summary")
  Map<String, Object> publicSummary() {
    return db.one(
        "SELECT count(*) FILTER(WHERE status<>'REJECTED') AS total,count(*) FILTER(WHERE status IN"
            + " ('VERIFIED','ASSIGNED','IN_PROGRESS')) AS verified,count(*) FILTER(WHERE"
            + " status='RESOLVED') AS resolved,count(DISTINCT reporter_id) FILTER(WHERE"
            + " status<>'REJECTED') AS contributors,count(*) FILTER(WHERE is_demo) AS"
            + " \"demoReports\" FROM reports",
        Map.of());
  }

  private Map<String, Object> scope() {
    var u = identity.staff();
    var p = new HashMap<String, Object>();
    p.put("all", u.admin());
    p.put("org", u.organizationId);
    return p;
  }

  private static final String WHERE = " WHERE (:all OR organization_id=:org)";

  @GetMapping("/municipal-summary")
  Map<String, Object> summary() {
    var p = scope();
    var r =
        db.one(
            "SELECT count(*) AS total,count(*) FILTER(WHERE status='PENDING_REVIEW') AS"
                + " pending,count(*) FILTER(WHERE status='VERIFIED') AS verified,count(*)"
                + " FILTER(WHERE severity='CRITICAL' AND status NOT IN ('RESOLVED','REJECTED')) AS"
                + " critical,count(*) FILTER(WHERE status='ASSIGNED') AS assigned,count(*)"
                + " FILTER(WHERE status='IN_PROGRESS') AS \"inProgress\",count(*) FILTER(WHERE"
                + " status='RESOLVED') AS resolved,round(avg(extract(epoch FROM"
                + " (resolved_at-created_at))/86400)::numeric,1) AS \"averageResolutionDays\" FROM"
                + " reports"
                + WHERE,
            p);
    r.put(
        "byStatus",
        db.rows(
            "SELECT status AS name,count(*) AS value FROM reports"
                + WHERE
                + " GROUP BY status ORDER BY value DESC",
            p));
    r.put(
        "bySeverity",
        db.rows(
            "SELECT severity AS name,count(*) AS value FROM reports"
                + WHERE
                + " GROUP BY severity ORDER BY value DESC",
            p));
    r.put(
        "byDamage",
        db.rows(
            "SELECT damage_type AS name,count(*) AS value FROM reports"
                + WHERE
                + " GROUP BY damage_type ORDER BY value DESC",
            p));
    r.put("trends", trends());
    r.put("hotspots", hotspots());
    return r;
  }

  @GetMapping("/report-trends")
  List<Map<String, Object>> trends() {
    return db.rows(
        "SELECT to_char(d.day,'Mon DD') AS name,count(r.id) AS reports,count(r.id) FILTER(WHERE"
            + " r.status='RESOLVED') AS resolved FROM generate_series(current_date-interval '13"
            + " days',current_date,interval '1 day') d(day) LEFT JOIN reports r ON"
            + " r.created_at>=d.day AND r.created_at<d.day+interval '1 day' AND (:all OR"
            + " r.organization_id=:org) GROUP BY d.day ORDER BY d.day",
        scope());
  }

  @GetMapping("/severity-breakdown")
  List<Map<String, Object>> severity() {
    return db.rows(
        "SELECT severity AS name,count(*) AS value FROM reports" + WHERE + " GROUP BY severity",
        scope());
  }

  @GetMapping("/resolution-performance")
  List<Map<String, Object>> performance() {
    return db.rows(
        "SELECT road_name AS name,count(*) AS reports,count(*) FILTER(WHERE status='RESOLVED') AS"
            + " resolved,round(avg(extract(epoch FROM(resolved_at-created_at))/86400)::numeric,1)"
            + " AS days FROM reports"
            + WHERE
            + " GROUP BY road_name ORDER BY reports DESC LIMIT 20",
        scope());
  }

  @GetMapping("/hazard-hotspots")
  List<Map<String, Object>> hotspots() {
    return db.rows(
        "SELECT round(latitude::numeric,3) AS latitude,round(longitude::numeric,3) AS"
            + " longitude,count(*) AS count,count(*) FILTER(WHERE severity IN ('HIGH','CRITICAL'))"
            + " AS critical FROM reports"
            + WHERE
            + " AND status NOT IN ('RESOLVED','REJECTED') GROUP BY 1,2 ORDER BY count DESC LIMIT"
            + " 50",
        scope());
  }
}
