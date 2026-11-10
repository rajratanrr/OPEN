package com.roadsaathi.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.roadsaathi.ai.AiService;
import com.roadsaathi.common.Db;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

@RestController
public class PublicConfigController {
  private final AiService ai;
  private final Db db;
  private final ObjectMapper json;
  private final boolean demo, mail;

  public PublicConfigController(
      AiService ai,
      Db db,
      ObjectMapper json,
      @Value("${roadsaathi.demo-seed}") boolean demo,
      @Value("${roadsaathi.mail-enabled}") boolean mail) {
    this.ai = ai;
    this.db = db;
    this.json = json;
    this.demo = demo;
    this.mail = mail;
  }

  @GetMapping("/api/v1/config")
  Map<String, Object> config() throws Exception {
    return Map.of(
        "aiEnabled",
        ai.enabled(),
        "demoMode",
        demo,
        "mailEnabled",
        mail,
        "city",
        "Ludhiana",
        "center",
        List.of(30.9010, 75.8573),
        "detection",
        json.readTree(
            db.one("SELECT value FROM system_settings WHERE key='detection'", Map.of())
                .get("value")
                .toString()));
  }
}
