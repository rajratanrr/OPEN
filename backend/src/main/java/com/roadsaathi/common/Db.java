package com.roadsaathi.common;

import java.util.*;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class Db {
  public final NamedParameterJdbcTemplate jdbc;

  public Db(NamedParameterJdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public List<Map<String, Object>> rows(String sql, Map<String, ?> params) {
    return jdbc.queryForList(sql, params);
  }

  public Map<String, Object> one(String sql, Map<String, ?> params) {
    var rows = rows(sql, params);
    if (rows.isEmpty()) throw ApiException.missing();
    return rows.getFirst();
  }

  public int update(String sql, Map<String, ?> params) {
    return jdbc.update(sql, params);
  }

  public long count(String sql, Map<String, ?> params) {
    return Objects.requireNonNull(jdbc.queryForObject(sql, params, Long.class));
  }

  public void audit(UUID actor, String action, String type, UUID id) {
    update(
        "INSERT INTO audit_logs(id,actor_id,action,entity_type,entity_id)"
            + " VALUES(:id,:actor,:action,:type,:entity)",
        Map.of(
            "id", UUID.randomUUID(), "actor", actor, "action", action, "type", type, "entity", id));
  }

  public void notify(UUID user, String title, String message, UUID report) {
    update(
        "INSERT INTO notifications(id,user_id,type,title,message,related_report_id) SELECT"
            + " :id,:u,'REPORT_UPDATE',:t,:m,:r WHERE EXISTS(SELECT 1 FROM users WHERE id=:u AND"
            + " notifications_enabled)",
        Map.of("id", UUID.randomUUID(), "u", user, "t", title, "m", message, "r", report));
  }

  public void points(UUID user, UUID report, int points, String reason) {
    update(
        "INSERT INTO point_transactions(id,user_id,report_id,points,reason)"
            + " VALUES(:id,:u,:r,:p,:why) ON CONFLICT(user_id,report_id,reason) DO NOTHING",
        Map.of("id", UUID.randomUUID(), "u", user, "r", report, "p", points, "why", reason));
  }
}
