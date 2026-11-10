package com.roadsaathi.repair;

import com.roadsaathi.common.Db;
import com.roadsaathi.report.*;
import com.roadsaathi.report.Types.Status;
import com.roadsaathi.security.Identity;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/municipal")
public class MunicipalController {
  private final ReportService reports;
  private final Identity identity;
  private final Db db;

  public MunicipalController(ReportService r, Identity i, Db db) {
    reports = r;
    identity = i;
    this.db = db;
  }

  record Reason(@NotBlank @Size(min = 10, max = 1500) String reason) {}

  record Evidence(@NotNull UUID evidenceId, @Size(max = 1500) String notes) {}

  record Note(@NotBlank @Size(max = 1500) String note) {}

  @GetMapping("/reports")
  Map<String, Object> list(@RequestParam Map<String, String> f) {
    return reports.list(f, identity.staff(), false, true);
  }

  @GetMapping("/reports/pending")
  Map<String, Object> pending(@RequestParam Map<String, String> f) {
    f = new HashMap<>(f);
    f.put("status", "PENDING_REVIEW");
    return reports.list(f, identity.staff(), false, true);
  }

  @PatchMapping("/reports/{id}/status")
  Map<String, Object> status(@PathVariable UUID id, @Valid @RequestBody ReportService.Change c) {
    return reports.change(id, c, identity.staff());
  }

  @PostMapping("/reports/{id}/verify")
  Map<String, Object> verify(@PathVariable UUID id) {
    return reports.change(
        id,
        new ReportService.Change(
            Status.VERIFIED,
            "Evidence reviewed by municipal officer.",
            null,
            null,
            null,
            null,
            null),
        identity.staff());
  }

  @PostMapping("/reports/{id}/reject")
  Map<String, Object> reject(@PathVariable UUID id, @Valid @RequestBody Reason r) {
    return reports.change(
        id,
        new ReportService.Change(Status.REJECTED, r.reason, null, null, null, null, null),
        identity.staff());
  }

  @PostMapping("/reports/{id}/assign")
  Map<String, Object> assign(@PathVariable UUID id, @Valid @RequestBody ReportService.Change c) {
    return reports.change(
        id,
        new ReportService.Change(
            Status.ASSIGNED, c.reason(), c.assignedTo(), c.priority(), c.dueDate(), null, null),
        identity.staff());
  }

  @PostMapping("/reports/{id}/repair-evidence")
  Map<String, Object> repair(@PathVariable UUID id, @Valid @RequestBody Evidence e) {
    return reports.repairEvidence(id, e.evidenceId, e.notes, identity.staff());
  }

  @PostMapping("/reports/{id}/notes")
  Map<String, Boolean> note(@PathVariable UUID id, @Valid @RequestBody Note n) {
    reports.note(id, n.note, identity.staff());
    return Map.of("success", true);
  }

  @GetMapping("/officers")
  List<Map<String, Object>> officers() {
    var u = identity.staff();
    var p = new HashMap<String, Object>();
    p.put("admin", u.admin());
    p.put("org", u.organizationId);
    return db.rows(
        "SELECT id,name,organization_id AS \"organizationId\" FROM users WHERE active AND"
            + " role='MUNICIPAL_OFFICER' AND (:admin OR organization_id=:org) ORDER BY name",
        p);
  }
}
