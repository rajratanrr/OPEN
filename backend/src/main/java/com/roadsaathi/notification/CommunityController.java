package com.roadsaathi.notification;

import com.roadsaathi.common.*;
import com.roadsaathi.security.Identity;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class CommunityController {
  private final Db db;
  private final Identity identity;

  public CommunityController(Db d, Identity i) {
    db = d;
    identity = i;
  }

  @GetMapping("/notifications")
  List<Map<String, Object>> notifications() {
    return db.rows(
        "SELECT id,type,title,message,related_report_id AS \"reportId\",is_read AS"
            + " \"isRead\",created_at AS \"createdAt\" FROM notifications WHERE user_id=:u ORDER BY"
            + " created_at DESC LIMIT 100",
        Map.of("u", identity.user().id));
  }

  @PatchMapping("/notifications/{id}/read")
  Map<String, Boolean> read(@PathVariable UUID id) {
    if (db.update(
            "UPDATE notifications SET is_read=true WHERE id=:id AND user_id=:u",
            Map.of("id", id, "u", identity.user().id))
        == 0) throw ApiException.missing();
    return Map.of("success", true);
  }

  @PatchMapping("/notifications/read-all")
  Map<String, Boolean> readAll() {
    db.update(
        "UPDATE notifications SET is_read=true WHERE user_id=:u", Map.of("u", identity.user().id));
    return Map.of("success", true);
  }

  @GetMapping("/rewards/me")
  Map<String, Object> rewards() {
    var p = Map.of("u", identity.user().id);
    var r =
        db.one(
            "SELECT coalesce(sum(points),0) AS points,count(*) FILTER(WHERE reason='VERIFIED') AS"
                + " verified,count(*) FILTER(WHERE reason='SUBMITTED') AS submitted FROM"
                + " point_transactions WHERE user_id=:u",
            p);
    long verified = ((Number) r.get("verified")).longValue(),
        submitted = ((Number) r.get("submitted")).longValue();
    var badges = new ArrayList<String>();
    if (submitted > 0) badges.add("First Reporter");
    if (verified >= 5) badges.add("Road Guardian");
    if (verified >= 20) badges.add("Community Protector");
    if (verified >= 50) badges.add("Safety Champion");
    r.put("badges", badges);
    return r;
  }

  @GetMapping("/rewards/history")
  List<Map<String, Object>> rewardHistory() {
    return db.rows(
        "SELECT id,report_id AS \"reportId\",points,reason,created_at AS \"createdAt\" FROM"
            + " point_transactions WHERE user_id=:u ORDER BY created_at DESC LIMIT 100",
        Map.of("u", identity.user().id));
  }

  @GetMapping("/rewards/leaderboard")
  List<Map<String, Object>> leaderboard() {
    return db.rows(
        "SELECT u.public_display_name AS name,coalesce(sum(p.points),0) AS points,count(*)"
            + " FILTER(WHERE p.reason='VERIFIED') AS verified FROM users u LEFT JOIN"
            + " point_transactions p ON p.user_id=u.id WHERE u.active AND u.leaderboard_opt_in"
            + " GROUP BY u.id,u.public_display_name ORDER BY points DESC,u.id LIMIT 50",
        Map.of());
  }
}
