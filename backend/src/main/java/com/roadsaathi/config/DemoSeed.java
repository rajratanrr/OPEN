package com.roadsaathi.config;

import com.roadsaathi.common.Db;
import com.roadsaathi.storage.EvidenceService;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.*;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DemoSeed implements ApplicationRunner {
  private final Db db;
  private final EvidenceService storage;
  private final PasswordEncoder passwords;
  private final boolean enabled;
  private final Environment env;

  public DemoSeed(
      Db db,
      EvidenceService storage,
      PasswordEncoder passwords,
      @Value("${roadsaathi.demo-seed}") boolean enabled,
      Environment env) {
    this.db = db;
    this.storage = storage;
    this.passwords = passwords;
    this.enabled = enabled;
    this.env = env;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) throws Exception {
    if (!enabled) return;
    if (!Arrays.asList(env.getActiveProfiles()).contains("dev"))
      throw new IllegalStateException("DEMO_SEED is allowed only in the dev profile");
    db.count("SELECT 1 FROM pg_advisory_xact_lock(762561)", Map.of());
    if (db.count("SELECT count(*) FROM system_settings WHERE key='demo_seed_v1'", Map.of()) > 0)
      return;
    UUID org = UUID.fromString("10000000-0000-0000-0000-000000000001");
    db.update(
        "INSERT INTO organizations(id,name,jurisdiction) VALUES(:id,'Ludhiana Municipal Corporation"
            + " · demo jurisdiction',ST_MakeEnvelope(75.70,30.78,76.05,31.03,4326)) ON CONFLICT DO"
            + " NOTHING",
        Map.of("id", org));
    UUID citizen = account("citizen@roadsaathi.demo", "Aarav Singh", "CITIZEN", null),
        other = account("simran@roadsaathi.demo", "Simran Kaur", "CITIZEN", null),
        officer = account("officer@roadsaathi.demo", "Gurpreet Singh", "MUNICIPAL_OFFICER", org);
    account("admin@roadsaathi.demo", "City Administrator", "SUPER_ADMIN", null);
    String[] roads = {
      "Ferozepur Road",
      "Pakhowal Road",
      "Dugri Road",
      "Gill Road",
      "Mall Road",
      "Model Town Road",
      "Hambran Road",
      "Chandigarh Road",
      "Civil Lines",
      "BRS Nagar Main Road",
      "Rani Jhansi Road",
      "Haibowal Road"
    };
    double[][] coords = {
      {30.8959, 75.8228},
      {30.8785, 75.8294},
      {30.8671, 75.8507},
      {30.8801, 75.8660},
      {30.9105, 75.8458},
      {30.8815, 75.8409},
      {30.9280, 75.8261},
      {30.9070, 75.8991},
      {30.9173, 75.8410},
      {30.8848, 75.8113},
      {30.9051, 75.8391},
      {30.9291, 75.8377}
    };
    String[] states = {
      "VERIFIED",
      "PENDING_REVIEW",
      "IN_PROGRESS",
      "ASSIGNED",
      "RESOLVED",
      "VERIFIED",
      "PENDING_REVIEW",
      "VERIFIED",
      "RESOLVED",
      "IN_PROGRESS",
      "RESOLVED",
      "PENDING_REVIEW"
    };
    String[] severity = {
      "HIGH",
      "MEDIUM",
      "CRITICAL",
      "HIGH",
      "LOW",
      "MEDIUM",
      "HIGH",
      "CRITICAL",
      "LOW",
      "MEDIUM",
      "LOW",
      "UNKNOWN"
    };
    for (int i = 0; i < roads.length; i++) {
      UUID id = UUID.randomUUID(), eid = UUID.randomUUID(), owner = i % 3 == 0 ? other : citizen;
      String key = eid + ".jpg";
      byte[] image = demoImage(i);
      storage.write(key, image);
      db.update(
          "INSERT INTO evidence(id,owner_id,storage_key,content_type,image_size)"
              + " VALUES(:id,:u,:k,'image/jpeg',:s)",
          Map.of("id", eid, "u", owner, "k", key, "s", image.length));
      var p = new HashMap<String, Object>();
      p.put("id", id);
      p.put("u", owner);
      p.put("o", org);
      p.put("key", UUID.randomUUID());
      p.put("road", roads[i]);
      p.put(
          "d",
          "Demonstration report for "
              + roads[i]
              + ". This is synthetic training data, not verified municipal information.");
      p.put("lat", coords[i][0]);
      p.put("lng", coords[i][1]);
      p.put("type", i == 3 ? "CRACK" : i == 6 ? "WATERLOGGING" : "POTHOLE");
      p.put("s", severity[i]);
      p.put("state", states[i]);
      p.put("e", eid);
      p.put("days", i + 1);
      p.put("officer", officer);
      db.update(
          "INSERT INTO"
              + " reports(id,reporter_id,organization_id,client_request_id,road_name,description,latitude,longitude,damage_type,severity,status,evidence_id,is_demo,created_at,updated_at,resolved_at,assigned_to,priority,due_date)"
              + " VALUES(:id,:u,:o,:key,:road,:d,:lat,:lng,:type,:s,:state,:e,true,now()-(:days*interval"
              + " '1 day'),now()-interval '1 hour',CASE WHEN :state='RESOLVED' THEN now()-interval"
              + " '1 day' ELSE NULL END,CASE WHEN :state IN ('ASSIGNED','IN_PROGRESS','RESOLVED')"
              + " THEN cast(:officer AS uuid) ELSE NULL END,'NORMAL',current_date+3)",
          p);
      db.update(
          "INSERT INTO report_status_history(id,report_id,new_status,changed_by,reason,changed_at)"
              + " VALUES(:h,:id,'PENDING_REVIEW',:u,'Synthetic demo report"
              + " created',now()-(:days*interval '1 day'))",
          Map.of("h", UUID.randomUUID(), "id", id, "u", owner, "days", i + 1));
      if (!states[i].equals("PENDING_REVIEW"))
        db.update(
            "INSERT INTO"
                + " report_status_history(id,report_id,previous_status,new_status,changed_by,reason)"
                + " VALUES(:h,:id,'PENDING_REVIEW',:s,:u,'Imported demonstration status; not a real"
                + " municipal action')",
            Map.of("h", UUID.randomUUID(), "id", id, "s", states[i], "u", officer));
      db.points(owner, id, 10, "SUBMITTED");
      if (!states[i].equals("PENDING_REVIEW")) db.points(owner, id, 20, "VERIFIED");
      db.notify(
          owner,
          "Demo report update",
          roads[i] + " · " + states[i].toLowerCase().replace('_', ' '),
          id);
    }
    db.update("INSERT INTO system_settings(key,value) VALUES('demo_seed_v1','true')", Map.of());
  }

  private UUID account(String email, String name, String role, UUID org) {
    UUID id = UUID.randomUUID();
    var p = new HashMap<String, Object>();
    p.put("id", id);
    p.put("email", email);
    p.put("name", name);
    p.put("role", role);
    p.put("org", org);
    p.put("password", passwords.encode(env.getProperty("DEMO_PASSWORD", "RoadDemo!2026")));
    db.update(
        "INSERT INTO"
            + " users(id,name,email,password_hash,role,organization_id,public_display_name,leaderboard_opt_in)"
            + " VALUES(:id,:name,:email,:password,:role,:org,:name,true) ON CONFLICT(email) DO"
            + " NOTHING",
        p);
    return (UUID)
        db.one("SELECT id FROM users WHERE email=:email", Map.of("email", email)).get("id");
  }

  private byte[] demoImage(int seed) throws Exception {
    var image = new BufferedImage(960, 600, BufferedImage.TYPE_INT_RGB);
    var g = image.createGraphics();
    g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
    g.setColor(new Color(46, 55, 60));
    g.fillRect(0, 0, 960, 600);
    var random = new Random(seed);
    for (int i = 0; i < 12000; i++) {
      int grey = 45 + random.nextInt(40);
      g.setColor(new Color(grey, grey + 3, grey + 4));
      g.fillRect(random.nextInt(960), random.nextInt(600), 2, 2);
    }
    g.setColor(new Color(210, 201, 164));
    for (int y = 0; y < 600; y += 170) g.fillRoundRect(740, y, 18, 100, 3, 3);
    g.setColor(new Color(28, 32, 34));
    g.fillOval(240, 180, 340, 210);
    g.setColor(new Color(77, 85, 84));
    g.setStroke(new BasicStroke(8));
    g.drawOval(240, 180, 340, 210);
    g.setColor(new Color(12, 30, 31));
    g.fillRect(0, 500, 960, 100);
    g.setColor(new Color(129, 218, 186));
    g.setFont(new Font("SansSerif", Font.BOLD, 30));
    g.drawString("DEMO · ILLUSTRATION, NOT ROAD EVIDENCE", 36, 554);
    g.dispose();
    var out = new ByteArrayOutputStream();
    ImageIO.write(image, "jpg", out);
    return out.toByteArray();
  }
}
