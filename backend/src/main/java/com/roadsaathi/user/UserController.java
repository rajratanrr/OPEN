package com.roadsaathi.user;

import com.roadsaathi.auth.AuthService;
import com.roadsaathi.common.Db;
import com.roadsaathi.security.Identity;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users/me")
public class UserController {
  private final Identity identity;
  private final UserRepository users;
  private final Db db;
  private final AuthService auth;

  public UserController(Identity i, UserRepository users, Db db, AuthService auth) {
    identity = i;
    this.users = users;
    this.db = db;
    this.auth = auth;
  }

  record Profile(
      @NotBlank @Size(max = 100) String name,
      @NotBlank @Size(max = 100) String publicDisplayName,
      boolean leaderboardOptIn,
      boolean notificationsEnabled) {}

  record Password(@NotBlank String currentPassword, @Size(min = 10, max = 72) String password) {}

  @GetMapping
  User.View me() {
    return identity.user().view();
  }

  @PatchMapping
  @Transactional
  User.View update(@Valid @RequestBody Profile p) {
    var u = identity.user();
    u.name = p.name.strip();
    u.publicDisplayName = p.publicDisplayName.strip();
    u.leaderboardOptIn = p.leaderboardOptIn;
    u.notificationsEnabled = p.notificationsEnabled;
    u.updatedAt = Instant.now();
    users.save(u);
    return u.view();
  }

  @PostMapping("/password")
  Map<String, String> password(@Valid @RequestBody Password p) {
    auth.changePassword(identity.user(), p.currentPassword, p.password);
    return Map.of("message", "Password changed. Please sign in again.");
  }

  @GetMapping("/stats")
  Map<String, Object> stats() {
    return db.one(
        "SELECT count(*) AS total, count(*) FILTER(WHERE status IN"
            + " ('VERIFIED','ASSIGNED','IN_PROGRESS','RESOLVED')) AS verified,count(*) FILTER(WHERE"
            + " status='RESOLVED') AS resolved,(SELECT coalesce(sum(points),0) FROM"
            + " point_transactions WHERE user_id=:u) AS points FROM reports WHERE reporter_id=:u",
        Map.of("u", identity.user().id));
  }

  @DeleteMapping
  @Transactional
  Map<String, Boolean> delete() {
    var u = identity.user();
    u.active = false;
    u.name = "Deleted account";
    u.publicDisplayName = "Deleted contributor";
    u.email = u.id + "@deleted.invalid";
    u.leaderboardOptIn = false;
    users.save(u);
    db.update("UPDATE refresh_sessions SET revoked=true WHERE user_id=:u", Map.of("u", u.id));
    db.update("DELETE FROM monitoring_sessions WHERE user_id=:u", Map.of("u", u.id));
    db.update("DELETE FROM notifications WHERE user_id=:u", Map.of("u", u.id));
    db.audit(u.id, "DELETE_ACCOUNT", "USER", u.id);
    return Map.of("success", true);
  }
}
