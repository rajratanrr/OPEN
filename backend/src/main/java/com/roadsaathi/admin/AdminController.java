package com.roadsaathi.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.roadsaathi.common.*;
import com.roadsaathi.security.Identity;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {
  private final Db db;
  private final Identity identity;
  private final ObjectMapper json;

  public AdminController(Db db, Identity i, ObjectMapper j) {
    this.db = db;
    identity = i;
    json = j;
  }

  record Role(
      @NotBlank @Pattern(regexp = "CITIZEN|MUNICIPAL_OFFICER|SUPER_ADMIN") String role,
      UUID organizationId,
      boolean active) {}

  record Org(
      @NotBlank @Size(max = 160) String name,
      @Min(-90) @Max(90) double south,
      @Min(-90) @Max(90) double north,
      @Min(-180) @Max(180) double west,
      @Min(-180) @Max(180) double east) {}

  record Settings(
      @Min(5) @Max(100) int duplicateRadiusMeters,
      @Min(30) @Max(1000) int alertRadiusMeters,
      @Min(3) @Max(20) double bumpThreshold) {}

  @GetMapping("/users")
  List<Map<String, Object>> users(@RequestParam(defaultValue = "0") int page) {
    identity.admin();
    if (page < 0 || page > 100000) throw new ApiException(400, "Invalid page");
    return db.rows(
        "SELECT id,name,email,role,organization_id AS \"organizationId\",active,created_at AS"
            + " \"createdAt\" FROM users ORDER BY created_at DESC LIMIT 50 OFFSET :offset",
        Map.of("offset", page * 50));
  }

  @PatchMapping("/users/{id}/role")
  @Transactional
  Map<String, Boolean> role(@PathVariable UUID id, @Valid @RequestBody Role r) {
    var admin = identity.admin();
    if (id.equals(admin.id))
      throw new ApiException(400, "Use another administrator to change your own access");
    if (r.role.equals("MUNICIPAL_OFFICER")
        && (r.organizationId == null
            || db.count(
                    "SELECT count(*) FROM organizations WHERE id=:id",
                    Map.of("id", r.organizationId))
                == 0)) throw new ApiException(400, "An officer requires a valid jurisdiction");
    var p = new HashMap<String, Object>();
    p.put("id", id);
    p.put("r", r.role);
    p.put("o", r.role.equals("MUNICIPAL_OFFICER") ? r.organizationId : null);
    p.put("a", r.active);
    if (db.update(
            "UPDATE users SET role=:r,organization_id=:o,active=:a,updated_at=now() WHERE id=:id",
            p)
        == 0) throw ApiException.missing();
    db.update("UPDATE refresh_sessions SET revoked=true WHERE user_id=:id", Map.of("id", id));
    db.audit(admin.id, "CHANGE_ROLE", "USER", id);
    return Map.of("success", true);
  }

  @GetMapping("/organizations")
  List<Map<String, Object>> orgs() {
    identity.admin();
    return db.rows(
        "SELECT id,name,type,ST_AsGeoJSON(jurisdiction)::text AS boundary FROM organizations ORDER"
            + " BY name",
        Map.of());
  }

  @PostMapping("/organizations")
  @Transactional
  Map<String, Object> createOrg(@Valid @RequestBody Org o) {
    var u = identity.admin();
    if (o.south >= o.north || o.west >= o.east)
      throw new ApiException(400, "Invalid jurisdiction bounds");
    UUID id = UUID.randomUUID();
    db.update(
        "INSERT INTO organizations(id,name,jurisdiction)"
            + " VALUES(:id,:name,ST_MakeEnvelope(:w,:s,:e,:n,4326))",
        Map.of("id", id, "name", o.name, "w", o.west, "s", o.south, "e", o.east, "n", o.north));
    db.audit(u.id, "CREATE_ORGANIZATION", "ORGANIZATION", id);
    return Map.of("id", id, "name", o.name);
  }

  @GetMapping("/audit-logs")
  List<Map<String, Object>> audit(@RequestParam(defaultValue = "0") int page) {
    identity.admin();
    if (page < 0 || page > 100000) throw new ApiException(400, "Invalid page");
    return db.rows(
        "SELECT a.id,a.action,a.entity_type AS \"entityType\",a.entity_id AS"
            + " \"entityId\",a.created_at AS \"createdAt\",u.name AS actor FROM audit_logs a LEFT"
            + " JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 50 OFFSET :offset",
        Map.of("offset", page * 50));
  }

  @GetMapping("/system-health")
  Map<String, Object> health() {
    identity.admin();
    return Map.of(
        "database",
        db.count("SELECT 1", Map.of()) == 1 ? "UP" : "DOWN",
        "reports",
        db.count("SELECT count(*) FROM reports", Map.of()),
        "users",
        db.count("SELECT count(*) FROM users", Map.of()));
  }

  @GetMapping("/settings")
  Object settings() throws Exception {
    identity.admin();
    return json.readTree(
        db.one("SELECT value FROM system_settings WHERE key='detection'", Map.of())
            .get("value")
            .toString());
  }

  @PutMapping("/settings")
  @Transactional
  Settings settings(@Valid @RequestBody Settings s) throws Exception {
    var u = identity.admin();
    db.update(
        "UPDATE system_settings SET value=cast(:v AS jsonb),updated_at=now() WHERE key='detection'",
        Map.of("v", json.writeValueAsString(s)));
    db.audit(u.id, "UPDATE_SETTINGS", "SETTINGS", u.id);
    return s;
  }
}
