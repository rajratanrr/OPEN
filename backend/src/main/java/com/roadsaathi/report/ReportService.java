package com.roadsaathi.report;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.roadsaathi.common.*;
import com.roadsaathi.report.Types.*;
import com.roadsaathi.storage.EvidenceService;
import com.roadsaathi.user.User;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.*;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReportService {
  public record Create(
      @NotNull UUID clientRequestId,
      @NotBlank @Size(max = 180) String roadName,
      @NotBlank @Size(min = 10, max = 3000) String description,
      @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
      @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
      @DecimalMin("0") @DecimalMax("5000") Double gpsAccuracyMeters,
      @NotNull Damage damageType,
      @NotNull Severity severity,
      @NotNull UUID evidenceId,
      UUID aiAnalysisId) {}

  public record Edit(
      @NotBlank @Size(max = 180) String roadName,
      @NotBlank @Size(min = 10, max = 3000) String description,
      @NotNull Damage damageType,
      @NotNull Severity severity) {}

  public record Change(
      @NotNull Status status,
      @Size(max = 1500) String reason,
      UUID assignedTo,
      @Size(max = 15) String priority,
      LocalDate dueDate,
      Damage damageType,
      Severity severity) {}

  private final Db db;
  private final EvidenceService evidence;
  private final ObjectMapper json;
  private final ApplicationEventPublisher events;
  private static final String SELECT =
      """
      SELECT r.id,r.road_name AS "roadName",r.description,r.latitude,r.longitude,r.gps_accuracy_meters AS "gpsAccuracyMeters",
      r.damage_type AS "damageType",r.severity,r.status,r.evidence_id AS "evidenceId",r.is_demo AS "isDemo",
      r.created_at AS "createdAt",r.updated_at AS "updatedAt",r.resolved_at AS "resolvedAt",r.assigned_to AS "assignedTo",r.priority,r.due_date AS "dueDate",
      o.name AS "organizationName",u.public_display_name AS "assignedOfficer",
      (SELECT count(*) FROM report_confirmations c WHERE c.report_id=r.id) AS confirmations,
      coalesce(a.analysis_status,'NOT_REQUESTED') AS "aiStatus"
      FROM reports r JOIN organizations o ON o.id=r.organization_id LEFT JOIN users u ON u.id=r.assigned_to LEFT JOIN ai_analyses a ON a.id=r.ai_analysis_id
      """;

  public ReportService(
      Db db, EvidenceService evidence, ObjectMapper json, ApplicationEventPublisher events) {
    this.db = db;
    this.evidence = evidence;
    this.json = json;
    this.events = events;
  }

  @Transactional
  public Map<String, Object> create(Create c, User user) {
    db.count(
        "SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(:key,0))",
        Map.of("key", user.id + ":" + c.clientRequestId));
    var existing =
        db.rows(
            "SELECT id FROM reports WHERE reporter_id=:u AND client_request_id=:k",
            Map.of("u", user.id, "k", c.clientRequestId));
    if (!existing.isEmpty()) return detail((UUID) existing.getFirst().get("id"), user);
    evidence.assertOwned(c.evidenceId, user.id);
    if (c.aiAnalysisId != null
        && db.count(
                "SELECT count(*) FROM ai_analyses WHERE id=:id AND owner_id=:u AND evidence_id=:e",
                Map.of("id", c.aiAnalysisId, "u", user.id, "e", c.evidenceId))
            == 0) throw new ApiException(400, "AI analysis does not match the selected photograph");
    var orgs =
        db.rows(
            "SELECT id FROM organizations WHERE"
                + " ST_Covers(jurisdiction,ST_SetSRID(ST_MakePoint(:lng,:lat),4326)) ORDER BY"
                + " ST_Area(jurisdiction) LIMIT 1",
            Map.of("lng", c.longitude, "lat", c.latitude));
    if (orgs.isEmpty())
      throw new ApiException(
          400,
          "This location is outside a configured jurisdiction. The initial supported area is"
              + " Ludhiana.");
    UUID id = UUID.randomUUID();
    var p = new HashMap<String, Object>();
    p.put("id", id);
    p.put("u", user.id);
    p.put("o", orgs.getFirst().get("id"));
    p.put("k", c.clientRequestId);
    p.put("road", c.roadName.strip());
    p.put("d", c.description.strip());
    p.put("lat", c.latitude);
    p.put("lng", c.longitude);
    p.put("acc", c.gpsAccuracyMeters);
    p.put("type", c.damageType.name());
    p.put("sev", c.severity.name());
    p.put("e", c.evidenceId);
    p.put("ai", c.aiAnalysisId);
    db.update(
        "INSERT INTO"
            + " reports(id,reporter_id,organization_id,client_request_id,road_name,description,latitude,longitude,gps_accuracy_meters,damage_type,severity,status,evidence_id,ai_analysis_id)"
            + " VALUES(:id,:u,:o,:k,:road,:d,:lat,:lng,:acc,:type,:sev,'PENDING_REVIEW',:e,:ai)",
        p);
    history(
        id,
        null,
        "PENDING_REVIEW",
        user.id,
        "Citizen report submitted; awaiting human verification.");
    db.points(user.id, id, 10, "SUBMITTED");
    db.notify(user.id, "Report received", c.roadName + " is in the review queue.", id);
    db.audit(user.id, "CREATE_REPORT", "REPORT", id);
    events.publishEvent(new ReportEvents.Changed(id));
    return detail(id, user);
  }

  public Map<String, Object> list(
      Map<String, String> filters, User user, boolean mine, boolean municipal) {
    int page = integer(filters, "page", 0, 0, 100000),
        size = integer(filters, "pageSize", 20, 1, 200);
    var p = new HashMap<String, Object>();
    String where = " WHERE true";
    if (mine) {
      if (user == null) throw new ApiException(401, "Please sign in");
      where += " AND r.reporter_id=:owner";
      p.put("owner", user.id);
    } else if (municipal) {
      if (user == null || !user.staff()) throw ApiException.forbidden();
      if (!user.admin()) {
        where += " AND r.organization_id=:org";
        p.put("org", user.organizationId);
      }
    } else where += " AND r.status<>'REJECTED'";
    for (String f : List.of("status", "severity", "damageType"))
      if (filters.containsKey(f) && !filters.get(f).isBlank() && !filters.get(f).equals("ALL")) {
        String v = filters.get(f);
        if (f.equals("status")) Status.valueOf(v);
        else if (f.equals("severity")) Severity.valueOf(v);
        else Damage.valueOf(v);
        where += " AND r." + (f.equals("damageType") ? "damage_type" : f) + "=:" + f;
        p.put(f, v);
      }
    if ("true".equals(filters.get("verifiedOnly")))
      where += " AND r.status IN ('VERIFIED','ASSIGNED','IN_PROGRESS')";
    if ("true".equals(filters.get("unresolved")))
      where += " AND r.status NOT IN ('RESOLVED','REJECTED')";
    if (filters.containsKey("q") && !filters.get("q").isBlank()) {
      where += " AND (r.road_name ILIKE :q OR cast(r.id AS text) ILIKE :q)";
      p.put(
          "q", "%" + filters.get("q").substring(0, Math.min(150, filters.get("q").length())) + "%");
    }
    if (filters.containsKey("from")) {
      where += " AND r.created_at>=cast(:from AS date)";
      p.put("from", LocalDate.parse(filters.get("from")).toString());
    }
    if (filters.containsKey("days")) {
      where += " AND r.created_at>=now()-(:days * interval '1 day')";
      p.put("days", integer(filters, "days", 30, 1, 3650));
    }
    if (filters.containsKey("south")) {
      double south = number(filters, "south", -90, 90),
          north = number(filters, "north", -90, 90),
          west = number(filters, "west", -180, 180),
          east = number(filters, "east", -180, 180);
      if (south > north || west > east) throw new ApiException(400, "Invalid map bounds");
      where += " AND r.location && ST_MakeEnvelope(:west,:south,:east,:north,4326)::geography";
      p.put("south", south);
      p.put("north", north);
      p.put("west", west);
      p.put("east", east);
    }
    if (filters.containsKey("latitude")) {
      p.put("lat", number(filters, "latitude", -90, 90));
      p.put("lng", number(filters, "longitude", -180, 180));
      p.put("radius", filters.containsKey("radius") ? number(filters, "radius", 1, 50000) : 1000);
      where +=
          " AND ST_DWithin(r.location,ST_SetSRID(ST_MakePoint(:lng,:lat),4326)::geography,:radius)";
    }
    long total = db.count("SELECT count(*) FROM reports r" + where, p);
    p.put("limit", size);
    p.put("offset", page * size);
    String sort =
        switch (filters.getOrDefault("sort", "newest")) {
          case "oldest" -> "r.created_at ASC";
          case "priority" ->
              "CASE r.severity WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 WHEN"
                  + " 'LOW' THEN 1 ELSE 0 END DESC,r.created_at ASC";
          default -> "r.created_at DESC";
        };
    return Map.of(
        "items",
        db.rows(SELECT + where + " ORDER BY " + sort + ",r.id LIMIT :limit OFFSET :offset", p),
        "total",
        total,
        "page",
        page,
        "pageSize",
        size);
  }

  public Map<String, Object> detail(UUID id, User user) {
    var raw = raw(id, false);
    checkReadable(raw, user);
    var result = db.one(SELECT + " WHERE r.id=:id", Map.of("id", id));
    result.put("history", history(id, user));
    result.put(
        "repairEvidence",
        db.rows(
            "SELECT e.id,e.evidence_id AS \"evidenceId\",e.notes,e.created_at AS \"createdAt\" FROM"
                + " repair_evidence e WHERE report_id=:id ORDER BY created_at",
            Map.of("id", id)));
    result.put("isOwner", user != null && user.id.equals(raw.get("reporter_id")));
    result.put("canManage", canManage(raw, user));
    result.put(
        "isConfirmed",
        user != null
            && db.count(
                    "SELECT count(*) FROM report_confirmations WHERE report_id=:r AND user_id=:u",
                    Map.of("r", id, "u", user.id))
                > 0);
    if (raw.get("ai_analysis_id") != null) {
      var a =
          db.one(
              "SELECT result,analysis_status AS status,model_name AS model FROM ai_analyses WHERE"
                  + " id=:id",
              Map.of("id", raw.get("ai_analysis_id")));
      if (a.get("result") != null)
        try {
          a.put("result", json.readTree(a.get("result").toString()));
        } catch (Exception e) {
          throw new IllegalStateException(e);
        }
      result.put("aiAnalysis", a);
    }
    if (canManage(raw, user))
      result.put(
          "internalNotes",
          db.rows(
              "SELECT n.id,n.note,n.created_at AS \"createdAt\",u.name AS author FROM"
                  + " internal_notes n JOIN users u ON u.id=n.author_id WHERE n.report_id=:id ORDER"
                  + " BY n.created_at DESC",
              Map.of("id", id)));
    result.put(
        "priorityExplanation",
        "Review severity, "
            + result.get("confirmations")
            + " independent confirmations, and report age. Traffic and accident data are not"
            + " available.");
    return result;
  }

  public List<Map<String, Object>> history(UUID id, User user) {
    checkReadable(raw(id, false), user);
    return db.rows(
        "SELECT id,previous_status AS \"previousStatus\",new_status AS"
            + " \"newStatus\",reason,changed_at AS \"changedAt\" FROM report_status_history WHERE"
            + " report_id=:id ORDER BY changed_at,id",
        Map.of("id", id));
  }

  private Map<String, Object> raw(UUID id, boolean lock) {
    return db.one(
        "SELECT * FROM reports WHERE id=:id" + (lock ? " FOR UPDATE" : ""), Map.of("id", id));
  }

  private boolean canManage(Map<String, Object> r, User u) {
    return u != null
        && u.staff()
        && (u.admin() || Objects.equals(u.organizationId, r.get("organization_id")));
  }

  private void checkReadable(Map<String, Object> r, User u) {
    if (r.get("status").equals("REJECTED")
        && (u == null || (!u.id.equals(r.get("reporter_id")) && !canManage(r, u))))
      throw ApiException.missing();
  }

  @Transactional
  public Map<String, Object> edit(UUID id, Edit c, User u) {
    var r = raw(id, true);
    if (!u.id.equals(r.get("reporter_id"))) throw ApiException.forbidden();
    if (!r.get("status").equals("PENDING_REVIEW"))
      throw new ApiException(409, "Only pending reports can be edited");
    db.update(
        "UPDATE reports SET"
            + " road_name=:road,description=:d,damage_type=:type,severity=:s,updated_at=now(),version=version+1"
            + " WHERE id=:id",
        Map.of(
            "id",
            id,
            "road",
            c.roadName,
            "d",
            c.description,
            "type",
            c.damageType.name(),
            "s",
            c.severity.name()));
    db.audit(u.id, "EDIT_REPORT", "REPORT", id);
    events.publishEvent(new ReportEvents.Changed(id));
    return detail(id, u);
  }

  public static boolean transitionAllowed(Status from, Status to) {
    return switch (from) {
      case PENDING_REVIEW -> to == Status.VERIFIED || to == Status.REJECTED;
      case VERIFIED -> to == Status.ASSIGNED || to == Status.REJECTED;
      case ASSIGNED -> to == Status.IN_PROGRESS || to == Status.ASSIGNED;
      case IN_PROGRESS -> to == Status.RESOLVED;
      case RESOLVED -> to == Status.VERIFIED;
      case REJECTED -> false;
    };
  }

  @Transactional
  public Map<String, Object> change(UUID id, Change c, User u) {
    var r = raw(id, true);
    if (!canManage(r, u)) throw ApiException.forbidden();
    Status old = Status.valueOf(r.get("status").toString());
    if (!transitionAllowed(old, c.status))
      throw new ApiException(409, "This status transition is not allowed");
    String reason = c.reason == null ? "" : c.reason.strip();
    if ((c.status == Status.REJECTED
            || old == Status.RESOLVED
            || c.damageType != null
            || c.severity != null)
        && reason.length() < 10)
      throw new ApiException(400, "Provide a reason of at least 10 characters");
    if (c.status == Status.RESOLVED
        && reason.length() < 15
        && db.count("SELECT count(*) FROM repair_evidence WHERE report_id=:id", Map.of("id", id))
            == 0)
      throw new ApiException(
          400,
          "Upload repair evidence or provide a documented completion reason of at least 15"
              + " characters");
    var p = new HashMap<String, Object>();
    p.put("id", id);
    p.put("s", c.status.name());
    p.put("type", c.damageType == null ? r.get("damage_type") : c.damageType.name());
    p.put("sev", c.severity == null ? r.get("severity") : c.severity.name());
    if (c.status == Status.ASSIGNED) {
      if (c.assignedTo == null
          || db.count(
                  "SELECT count(*) FROM users WHERE id=:id AND active AND role='MUNICIPAL_OFFICER'"
                      + " AND organization_id=:o",
                  Map.of("id", c.assignedTo, "o", r.get("organization_id")))
              == 0) throw new ApiException(400, "Assign an active officer in this jurisdiction");
      if (c.dueDate == null || c.dueDate.isBefore(LocalDate.now(java.time.ZoneOffset.UTC)))
        throw new ApiException(400, "Choose a valid target completion date");
      if (c.priority == null || !Set.of("LOW", "NORMAL", "HIGH", "URGENT").contains(c.priority))
        throw new ApiException(400, "Choose a repair priority");
      db.update(
          "UPDATE reports SET assigned_to=:officer,priority=:p,due_date=:due WHERE id=:id",
          Map.of("id", id, "officer", c.assignedTo, "p", c.priority, "due", c.dueDate));
    }
    db.update(
        "UPDATE reports SET"
            + " status=:s,damage_type=:type,severity=:sev,updated_at=now(),version=version+1,resolved_at=CASE"
            + " WHEN :s='RESOLVED' THEN now() ELSE NULL END WHERE id=:id",
        p);
    history(id, old.name(), c.status.name(), u.id, reason);
    UUID owner = (UUID) r.get("reporter_id");
    if (c.status == Status.VERIFIED) {
      db.points(owner, id, 20, "VERIFIED");
      for (var conf :
          db.rows("SELECT user_id FROM report_confirmations WHERE report_id=:r", Map.of("r", id)))
        db.points((UUID) conf.get("user_id"), id, 5, "CONFIRMED");
    }
    if (c.status == Status.REJECTED) {
      db.points(owner, id, -10, "REJECTED_SUBMISSION");
      if (old != Status.PENDING_REVIEW) db.points(owner, id, -20, "REJECTED_VERIFICATION");
      db.update(
          "INSERT INTO point_transactions(id,user_id,report_id,points,reason) SELECT"
              + " gen_random_uuid(),user_id,report_id,-5,'REJECTED_CONFIRMATION' FROM"
              + " point_transactions WHERE report_id=:r AND reason='CONFIRMED' ON CONFLICT DO"
              + " NOTHING",
          Map.of("r", id));
    }
    db.notify(
        owner,
        "Report " + c.status.name().toLowerCase(Locale.ROOT).replace('_', ' '),
        r.get("road_name") + " has a new repair update.",
        id);
    db.audit(u.id, "STATUS_" + c.status, "REPORT", id);
    events.publishEvent(new ReportEvents.Changed(id));
    return detail(id, u);
  }

  @Transactional
  public Map<String, Object> confirm(UUID id, User u, boolean add) {
    var r = raw(id, true);
    checkReadable(r, u);
    if (u.id.equals(r.get("reporter_id")))
      throw new ApiException(400, "You cannot confirm your own report");
    if (add) {
      if (Set.of("RESOLVED", "REJECTED").contains(r.get("status")))
        throw new ApiException(409, "This report is no longer an active hazard");
      db.update(
          "INSERT INTO report_confirmations(report_id,user_id) VALUES(:r,:u) ON CONFLICT DO"
              + " NOTHING",
          Map.of("r", id, "u", u.id));
      if (!r.get("status").equals("PENDING_REVIEW")) db.points(u.id, id, 5, "CONFIRMED");
    } else {
      db.update(
          "DELETE FROM report_confirmations WHERE report_id=:r AND user_id=:u",
          Map.of("r", id, "u", u.id));
      db.update(
          "DELETE FROM point_transactions WHERE report_id=:r AND user_id=:u AND reason='CONFIRMED'",
          Map.of("r", id, "u", u.id));
    }
    db.audit(u.id, add ? "CONFIRM_REPORT" : "REMOVE_CONFIRMATION", "REPORT", id);
    events.publishEvent(new ReportEvents.Changed(id));
    return detail(id, u);
  }

  @Transactional
  public Map<String, Object> repairEvidence(UUID id, UUID evidenceId, String notes, User u) {
    var r = raw(id, true);
    if (!canManage(r, u)) throw ApiException.forbidden();
    evidence.assertOwned(evidenceId, u.id);
    db.update(
        "INSERT INTO repair_evidence(id,report_id,evidence_id,uploaded_by,notes)"
            + " VALUES(:id,:r,:e,:u,:n)",
        Map.of(
            "id",
            UUID.randomUUID(),
            "r",
            id,
            "e",
            evidenceId,
            "u",
            u.id,
            "n",
            notes == null ? "" : notes));
    db.audit(u.id, "REPAIR_EVIDENCE", "REPORT", id);
    return detail(id, u);
  }

  @Transactional
  public void note(UUID id, String note, User u) {
    var r = raw(id, true);
    if (!canManage(r, u)) throw ApiException.forbidden();
    db.update(
        "INSERT INTO internal_notes(id,report_id,author_id,note) VALUES(:id,:r,:u,:n)",
        Map.of("id", UUID.randomUUID(), "r", id, "u", u.id, "n", note));
    db.audit(u.id, "INTERNAL_NOTE", "REPORT", id);
  }

  private void history(UUID id, String old, String next, UUID user, String reason) {
    var p = new HashMap<String, Object>();
    p.put("id", UUID.randomUUID());
    p.put("r", id);
    p.put("old", old);
    p.put("next", next);
    p.put("u", user);
    p.put("reason", reason);
    db.update(
        "INSERT INTO"
            + " report_status_history(id,report_id,previous_status,new_status,changed_by,reason)"
            + " VALUES(:id,:r,:old,:next,:u,:reason)",
        p);
  }

  public static int integer(Map<String, String> f, String key, int fallback, int min, int max) {
    int x = f.containsKey(key) ? Integer.parseInt(f.get(key)) : fallback;
    if (x < min || x > max) throw new ApiException(400, "Invalid " + key);
    return x;
  }

  public static double number(Map<String, String> f, String key, double min, double max) {
    double n = Double.parseDouble(f.get(key));
    if (!Double.isFinite(n) || n < min || n > max) throw new ApiException(400, "Invalid " + key);
    return n;
  }
}
