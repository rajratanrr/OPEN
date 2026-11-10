package com.roadsaathi.auth;

import com.roadsaathi.common.*;
import com.roadsaathi.security.Tokens;
import com.roadsaathi.user.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
  private final UserRepository users;
  private final Db db;
  private final PasswordEncoder passwords;
  private final Tokens tokens;
  private final JavaMailSender mail;
  private final boolean mailEnabled;
  private final String front, from;

  public record Session(User.View user, String access, String refresh) {}

  public AuthService(
      UserRepository users,
      Db db,
      PasswordEncoder passwords,
      Tokens tokens,
      JavaMailSender mail,
      @Value("${roadsaathi.mail-enabled}") boolean enabled,
      @Value("${roadsaathi.frontend-url}") String front,
      @Value("${roadsaathi.mail-from}") String from) {
    this.users = users;
    this.db = db;
    this.passwords = passwords;
    this.tokens = tokens;
    this.mail = mail;
    mailEnabled = enabled;
    this.front = front;
    this.from = from;
  }

  public void validatePassword(String password) {
    if (password == null
        || password.length() < 10
        || password.getBytes(StandardCharsets.UTF_8).length > 72)
      throw new ApiException(400, "Use a password of 10–72 bytes");
  }

  @Transactional
  public Session register(String name, String email, String password) {
    validatePassword(password);
    email = email.trim().toLowerCase(Locale.ROOT);
    if (users.findByEmail(email).isPresent())
      throw new ApiException(
          409, "Unable to register this email. Try signing in or resetting your password.");
    var u = new User();
    u.id = UUID.randomUUID();
    u.name = name.strip();
    u.email = email;
    u.passwordHash = passwords.encode(password);
    u.role = "CITIZEN";
    u.publicDisplayName = name.strip();
    users.saveAndFlush(u);
    db.audit(u.id, "REGISTER", "USER", u.id);
    return issue(u);
  }

  @Transactional
  public Session login(String email, String password) {
    var u = users.findByEmail(email.strip().toLowerCase(Locale.ROOT)).orElse(null);
    // A BCrypt comparison also runs for unknown accounts to reduce account-enumeration timing
    // differences.
    String hash =
        u == null ? "$2a$12$HK5eQWdQ43XvOzsQJfXXSu6IwKKkFwunFnSlvsuHjWqPpO31dSxla" : u.passwordHash;
    boolean valid = passwords.matches(password, hash);
    if (u == null || !valid || !u.active)
      throw new ApiException(401, "Email or password is incorrect");
    return issue(u);
  }

  private Session issue(User u) {
    UUID sid = UUID.randomUUID();
    String refresh = Tokens.random();
    db.update(
        "INSERT INTO refresh_sessions(id,user_id,token_hash,expires_at)"
            + " VALUES(:id,:u,:h,now()+interval '30 days')",
        Map.of("id", sid, "u", u.id, "h", Tokens.hash(refresh)));
    return new Session(u.view(), tokens.access(u.id, sid), refresh);
  }

  @Transactional
  public Session refresh(String value) {
    if (value == null) throw new ApiException(401, "Your session has expired");
    var rows =
        db.rows(
            "SELECT * FROM refresh_sessions WHERE token_hash=:h FOR UPDATE",
            Map.of("h", Tokens.hash(value)));
    if (rows.isEmpty()) throw new ApiException(401, "Your session has expired");
    var row = rows.getFirst();
    UUID sid = (UUID) row.get("id");
    if ((boolean) row.get("revoked")
        || db.count(
                "SELECT count(*) FROM refresh_sessions WHERE id=:id AND expires_at>now()",
                Map.of("id", sid))
            == 0) throw new ApiException(401, "Your session has expired");
    var u =
        users
            .findById((UUID) row.get("user_id"))
            .filter(x -> x.active)
            .orElseThrow(() -> new ApiException(401, "Your session has expired"));
    db.update("UPDATE refresh_sessions SET revoked=true WHERE id=:id", Map.of("id", sid));
    return issue(u);
  }

  @Transactional
  public void logout(String value) {
    if (value != null)
      db.update(
          "UPDATE refresh_sessions SET revoked=true WHERE token_hash=:h",
          Map.of("h", Tokens.hash(value)));
  }

  @Transactional
  public void forgot(String email) {
    if (!mailEnabled)
      throw new ApiException(
          503,
          "Password reset email is not configured on this installation. Contact the"
              + " administrator.");
    var u = users.findByEmail(email.strip().toLowerCase(Locale.ROOT)).filter(x -> x.active);
    if (u.isEmpty()) return;
    var token = Tokens.random();
    db.update(
        "INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES(:h,:u,now()+interval '30"
            + " minutes')",
        Map.of("h", Tokens.hash(token), "u", u.get().id));
    var message = new SimpleMailMessage();
    message.setFrom(from);
    message.setTo(u.get().email);
    message.setSubject("Reset your RoadSaathi password");
    message.setText(
        "Reset your password within 30 minutes: "
            + front
            + "/reset-password?token="
            + token
            + "\nIgnore this message if you did not request it.");
    try {
      mail.send(message);
    } catch (Exception e) {
      throw new ApiException(503, "Password reset email could not be sent. Try again later.");
    }
  }

  @Transactional
  public void reset(String token, String password) {
    validatePassword(password);
    var rows =
        db.rows(
            "SELECT user_id FROM password_resets WHERE token_hash=:h AND NOT used AND"
                + " expires_at>now() FOR UPDATE",
            Map.of("h", Tokens.hash(token)));
    if (rows.isEmpty()) throw new ApiException(400, "Reset link is invalid or expired");
    UUID uid = (UUID) rows.getFirst().get("user_id");
    var u = users.findById(uid).orElseThrow(ApiException::missing);
    u.passwordHash = passwords.encode(password);
    users.save(u);
    db.update("UPDATE password_resets SET used=true WHERE user_id=:u", Map.of("u", uid));
    db.update("UPDATE refresh_sessions SET revoked=true WHERE user_id=:u", Map.of("u", uid));
    db.audit(uid, "RESET_PASSWORD", "USER", uid);
  }

  @Transactional
  public void changePassword(User u, String old, String password) {
    if (!passwords.matches(old, u.passwordHash))
      throw new ApiException(400, "Current password is incorrect");
    validatePassword(password);
    u.passwordHash = passwords.encode(password);
    users.save(u);
    db.update("UPDATE refresh_sessions SET revoked=true WHERE user_id=:u", Map.of("u", u.id));
    db.audit(u.id, "CHANGE_PASSWORD", "USER", u.id);
  }
}
