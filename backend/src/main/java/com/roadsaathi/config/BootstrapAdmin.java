package com.roadsaathi.config;

import com.roadsaathi.common.Db;
import java.util.Map;
import java.util.UUID;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Explicit, one-time provisioning for an empty production database. */
@Component
public class BootstrapAdmin implements ApplicationRunner {
  private final Db db;
  private final Environment env;
  private final PasswordEncoder passwords;

  public BootstrapAdmin(Db db, Environment env, PasswordEncoder passwords) {
    this.db = db;
    this.env = env;
    this.passwords = passwords;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    String email = env.getProperty("BOOTSTRAP_ADMIN_EMAIL", "").strip().toLowerCase();
    String password = env.getProperty("BOOTSTRAP_ADMIN_PASSWORD", "");
    if (email.isEmpty() && password.isEmpty()) return;
    if (!email.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")
        || password.length() < 14
        || password.length() > 72)
      throw new IllegalStateException(
          "Bootstrap administrator needs a valid email and a 14–72 character password");
    db.count("SELECT 1 FROM pg_advisory_xact_lock(762562)", Map.of());
    if (db.count("SELECT count(*) FROM users WHERE role='SUPER_ADMIN' AND active", Map.of()) > 0)
      return;
    if (db.count("SELECT count(*) FROM users WHERE email=:email", Map.of("email", email)) > 0)
      throw new IllegalStateException(
          "Bootstrap email already belongs to a user; it will not be promoted automatically");
    UUID id = UUID.randomUUID();
    db.update(
        "INSERT INTO users(id,name,public_display_name,email,password_hash,role)"
            + " VALUES(:id,'Administrator','Administrator',:email,:password,'SUPER_ADMIN')",
        Map.of("id", id, "email", email, "password", passwords.encode(password)));
    db.audit(id, "BOOTSTRAP_ADMIN", "USER", id);
  }
}
