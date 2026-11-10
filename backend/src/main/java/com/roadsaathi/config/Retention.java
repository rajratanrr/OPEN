package com.roadsaathi.config;

import com.roadsaathi.common.Db;
import java.util.Map;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class Retention {
  private final Db db;

  public Retention(Db db) {
    this.db = db;
  }

  @Scheduled(fixedDelay = 3600000, initialDelay = 60000)
  public void cleanup() {
    db.update("DELETE FROM sensor_events WHERE recorded_at<now()-interval '7 days'", Map.of());
    db.update(
        "DELETE FROM monitoring_sessions WHERE status='STOPPED' AND started_at<now()-interval '30"
            + " days' AND NOT EXISTS(SELECT 1 FROM sensor_events WHERE"
            + " session_id=monitoring_sessions.id)",
        Map.of());
    db.update("DELETE FROM password_resets WHERE expires_at<now()-interval '1 day'", Map.of());
    db.update("DELETE FROM refresh_sessions WHERE expires_at<now()-interval '1 day'", Map.of());
  }
}
