package com.roadsaathi.user;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {
  @Id public UUID id;
  public String name;
  public String email;

  @Column(name = "password_hash")
  public String passwordHash;

  public String role;

  @Column(name = "organization_id")
  public UUID organizationId;

  @Column(name = "public_display_name")
  public String publicDisplayName;

  @Column(name = "leaderboard_opt_in")
  public boolean leaderboardOptIn;

  public boolean active = true;

  @Column(name = "notifications_enabled")
  public boolean notificationsEnabled = true;

  @Column(name = "created_at")
  public Instant createdAt = Instant.now();

  @Column(name = "updated_at")
  public Instant updatedAt = Instant.now();

  public record View(
      UUID id,
      String name,
      String email,
      String role,
      UUID organizationId,
      String publicDisplayName,
      boolean leaderboardOptIn,
      boolean notificationsEnabled) {}

  public View view() {
    return new View(
        id,
        name,
        email,
        role,
        organizationId,
        publicDisplayName,
        leaderboardOptIn,
        notificationsEnabled);
  }

  public boolean staff() {
    return role.equals("MUNICIPAL_OFFICER") || role.equals("SUPER_ADMIN");
  }

  public boolean admin() {
    return role.equals("SUPER_ADMIN");
  }
}
