package com.roadsaathi.monitoring;

import com.roadsaathi.common.*;
import com.roadsaathi.report.*;
import com.roadsaathi.security.Identity;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1")
public class MonitoringController {
  private final Db db;
  private final Identity identity;
  private final ReportService reports;
  private final ReportEvents events;

  public MonitoringController(Db db, Identity i, ReportService r, ReportEvents e) {
    this.db = db;
    identity = i;
    reports = r;
    events = e;
  }

  public record Sensor(
      @NotNull UUID id,
      @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
      @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
      @NotNull Instant recordedAt,
      @NotNull @DecimalMin("0") @DecimalMax("200") Double accelerationMagnitude,
      @NotNull @DecimalMin("0") @DecimalMax("2000") Double jerk,
      @NotNull @DecimalMin("1.5") @DecimalMax("60") Double estimatedSpeed,
      @NotNull @DecimalMin("0") @DecimalMax("50") Double gpsAccuracy) {}

  record Batch(@NotEmpty @Size(max = 100) List<@Valid Sensor> events) {}

  @PostMapping("/monitoring/sessions")
  @Transactional
  Map<String, Object> start() {
    UUID id = UUID.randomUUID(), u = identity.user().id;
    db.update(
        "INSERT INTO monitoring_sessions(id,user_id) VALUES(:id,:u) ON CONFLICT (user_id) WHERE"
            + " status='ACTIVE' DO NOTHING",
        Map.of("id", id, "u", u));
    return db.one(
        "SELECT id,started_at AS \"startedAt\",status FROM monitoring_sessions WHERE user_id=:u AND"
            + " status='ACTIVE'",
        Map.of("u", u));
  }

  @PatchMapping("/monitoring/sessions/{id}/stop")
  Map<String, Boolean> stop(@PathVariable UUID id) {
    if (db.update(
            "UPDATE monitoring_sessions SET status='STOPPED',ended_at=coalesce(ended_at,now())"
                + " WHERE id=:id AND user_id=:u",
            Map.of("id", id, "u", identity.user().id))
        == 0) throw ApiException.missing();
    return Map.of("success", true);
  }

  @GetMapping("/monitoring/sessions")
  List<Map<String, Object>> sessions() {
    return db.rows(
        "SELECT s.id,s.started_at AS \"startedAt\",s.ended_at AS \"endedAt\",s.status,(SELECT"
            + " count(*) FROM sensor_events e WHERE e.session_id=s.id) AS \"eventCount\" FROM"
            + " monitoring_sessions s WHERE user_id=:u ORDER BY started_at DESC LIMIT 50",
        Map.of("u", identity.user().id));
  }

  @GetMapping("/monitoring/sessions/{id}")
  Map<String, Object> session(@PathVariable UUID id) {
    var r = owned(id);
    r.put(
        "events",
        db.rows(
            "SELECT id,latitude,longitude,recorded_at AS \"recordedAt\",acceleration_magnitude AS"
                + " \"accelerationMagnitude\",verification_status AS \"verificationStatus\" FROM"
                + " sensor_events WHERE session_id=:id ORDER BY recorded_at LIMIT 1000",
            Map.of("id", id)));
    return r;
  }

  private Map<String, Object> owned(UUID id) {
    return db.one(
        "SELECT id,status,started_at AS \"startedAt\",ended_at AS \"endedAt\" FROM"
            + " monitoring_sessions WHERE id=:id AND user_id=:u",
        Map.of("id", id, "u", identity.user().id));
  }

  @PostMapping("/monitoring/sessions/{id}/events")
  @Transactional
  Map<String, Integer> submit(@PathVariable UUID id, @Valid @RequestBody Batch batch) {
    owned(id);
    int inserted = 0;
    for (var e : batch.events) {
      if (e.recordedAt.isAfter(Instant.now().plusSeconds(30))
          || e.recordedAt.isBefore(Instant.now().minusSeconds(7 * 86400)))
        throw new ApiException(400, "Sensor events must be within the last seven days");
      if (db.count(
              "SELECT count(*) FROM monitoring_sessions WHERE id=:id AND :t>=started_at - INTERVAL"
                  + " '30 seconds' AND (ended_at IS NULL OR :t<=ended_at + INTERVAL '30 seconds')",
              Map.of("id", id, "t", java.sql.Timestamp.from(e.recordedAt)))
          == 0) throw new ApiException(400, "Event was not recorded during this session");
      inserted +=
          db.update(
              "INSERT INTO"
                  + " sensor_events(id,session_id,latitude,longitude,recorded_at,acceleration_magnitude,jerk,estimated_speed,gps_accuracy)"
                  + " VALUES(:id,:s,:lat,:lng,:t,:a,:j,:v,:g) ON CONFLICT DO NOTHING",
              Map.of(
                  "id",
                  e.id,
                  "s",
                  id,
                  "lat",
                  e.latitude,
                  "lng",
                  e.longitude,
                  "t",
                  java.sql.Timestamp.from(e.recordedAt),
                  "a",
                  e.accelerationMagnitude,
                  "j",
                  e.jerk,
                  "v",
                  e.estimatedSpeed,
                  "g",
                  e.gpsAccuracy));
    }
    return Map.of("inserted", inserted, "received", batch.events.size());
  }

  @GetMapping("/hazards/nearby")
  Map<String, Object> hazards(@RequestParam Map<String, String> f) {
    if (!f.containsKey("latitude") || !f.containsKey("longitude"))
      throw new ApiException(400, "A GPS location is required");
    f = new HashMap<>(f);
    f.put("verifiedOnly", "true");
    f.putIfAbsent("radius", "150");
    return reports.list(f, identity.optional(), false, false);
  }

  @GetMapping(value = "/hazards/stream", produces = "text/event-stream")
  SseEmitter stream() {
    return events.connect();
  }
}
