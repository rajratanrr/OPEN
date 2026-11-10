package com.roadsaathi.report;

import com.roadsaathi.security.Identity;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class ReportController {
  private final ReportService reports;
  private final Identity identity;

  public ReportController(ReportService r, Identity i) {
    reports = r;
    identity = i;
  }

  @PostMapping("/reports")
  @ResponseStatus(HttpStatus.CREATED)
  Map<String, Object> create(@Valid @RequestBody ReportService.Create c) {
    return reports.create(c, identity.user());
  }

  @GetMapping({"/reports", "/reports/map", "/reports/nearby"})
  Map<String, Object> list(@RequestParam Map<String, String> filters) {
    return reports.list(filters, identity.optional(), false, false);
  }

  @GetMapping("/users/me/reports")
  Map<String, Object> mine(@RequestParam Map<String, String> filters) {
    return reports.list(filters, identity.user(), true, false);
  }

  @GetMapping("/reports/{id}")
  Map<String, Object> detail(@PathVariable UUID id) {
    return reports.detail(id, identity.optional());
  }

  @GetMapping("/reports/{id}/history")
  List<Map<String, Object>> history(@PathVariable UUID id) {
    return reports.history(id, identity.optional());
  }

  @PatchMapping("/reports/{id}")
  Map<String, Object> edit(@PathVariable UUID id, @Valid @RequestBody ReportService.Edit e) {
    return reports.edit(id, e, identity.user());
  }

  @PostMapping("/reports/{id}/confirm")
  Map<String, Object> confirm(@PathVariable UUID id) {
    return reports.confirm(id, identity.user(), true);
  }

  @DeleteMapping("/reports/{id}/confirm")
  Map<String, Object> unconfirm(@PathVariable UUID id) {
    return reports.confirm(id, identity.user(), false);
  }
}
