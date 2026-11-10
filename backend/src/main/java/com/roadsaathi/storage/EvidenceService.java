package com.roadsaathi.storage;

import com.roadsaathi.common.*;
import com.roadsaathi.user.User;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.net.URI;
import java.nio.file.*;
import java.util.*;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.*;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

@Service
public class EvidenceService {
  private final Db db;
  private final Path path;
  private final S3Client s3;
  private final String bucket;

  public EvidenceService(
      Db db,
      @Value("${roadsaathi.storage-path}") String path,
      @Value("${roadsaathi.storage-mode}") String mode,
      @Value("${roadsaathi.storage-endpoint}") String endpoint,
      @Value("${roadsaathi.storage-bucket}") String bucket,
      @Value("${roadsaathi.storage-access-key}") String access,
      @Value("${roadsaathi.storage-secret-key}") String secret)
      throws IOException {
    this.db = db;
    this.path = Path.of(path).toAbsolutePath().normalize();
    this.bucket = bucket;
    Files.createDirectories(this.path);
    s3 =
        mode.equals("s3")
            ? S3Client.builder()
                .region(Region.US_EAST_1)
                .endpointOverride(URI.create(endpoint))
                .forcePathStyle(true)
                .credentialsProvider(
                    StaticCredentialsProvider.create(AwsBasicCredentials.create(access, secret)))
                .build()
            : null;
  }

  public Map<String, Object> upload(MultipartFile file, User owner) throws IOException {
    if (file.isEmpty() || file.getSize() > 8 * 1024 * 1024)
      throw new ApiException(400, "Upload a JPEG or PNG image smaller than 8 MB");
    byte[] data = normalize(file.getBytes());
    UUID id = UUID.randomUUID();
    String key = id + ".jpg";
    write(key, data);
    try {
      db.update(
          "INSERT INTO evidence(id,owner_id,storage_key,content_type,image_size)"
              + " VALUES(:id,:u,:k,'image/jpeg',:s)",
          Map.of("id", id, "u", owner.id, "k", key, "s", data.length));
    } catch (RuntimeException e) {
      delete(key);
      throw e;
    }
    return Map.of(
        "id",
        id,
        "url",
        "/api/v1/evidence/" + id,
        "contentType",
        "image/jpeg",
        "size",
        data.length);
  }

  public byte[] normalize(byte[] input) throws IOException {
    try (var stream = ImageIO.createImageInputStream(new ByteArrayInputStream(input))) {
      var readers = ImageIO.getImageReaders(stream);
      if (!readers.hasNext()) throw new ApiException(400, "This file is not a supported image");
      var reader = readers.next();
      try {
        String format = reader.getFormatName().toLowerCase(Locale.ROOT);
        if (!Set.of("png", "jpeg", "jpg").contains(format))
          throw new ApiException(400, "Only JPEG and PNG images are supported");
        reader.setInput(stream);
        int w = reader.getWidth(0), h = reader.getHeight(0);
        if (w < 16 || h < 16 || (long) w * h > 20000000)
          throw new ApiException(400, "Image must be at least 16 pixels and at most 20 megapixels");
        var original = reader.read(0);
        double scale = Math.min(1, 1920.0 / Math.max(w, h));
        var clean =
            new BufferedImage((int) (w * scale), (int) (h * scale), BufferedImage.TYPE_INT_RGB);
        var g = clean.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, clean.getWidth(), clean.getHeight());
        g.setRenderingHint(
            RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.drawImage(original, 0, 0, clean.getWidth(), clean.getHeight(), null);
        g.dispose();
        var out = new ByteArrayOutputStream();
        ImageIO.write(clean, "jpg", out);
        return out.toByteArray();
      } finally {
        reader.dispose();
      }
    }
  }

  public void assertOwned(UUID id, UUID user) {
    if (db.count(
            "SELECT count(*) FROM evidence WHERE id=:id AND owner_id=:u",
            Map.of("id", id, "u", user))
        == 0) throw new ApiException(400, "Select an image uploaded by this account");
  }

  public byte[] read(UUID id, User viewer) throws IOException {
    var record = db.one("SELECT * FROM evidence WHERE id=:id", Map.of("id", id));
    boolean published =
        db.count(
                    "SELECT count(*) FROM reports WHERE evidence_id=:id AND status<>'REJECTED'",
                    Map.of("id", id))
                > 0
            || db.count(
                    "SELECT count(*) FROM repair_evidence e JOIN reports r ON r.id=e.report_id"
                        + " WHERE e.evidence_id=:id AND r.status<>'REJECTED'",
                    Map.of("id", id))
                > 0;
    if (!published && (viewer == null || !viewer.id.equals(record.get("owner_id")))) {
      boolean scopedStaff =
          viewer != null
              && viewer.staff()
              && db.count(
                      "SELECT count(*) FROM reports WHERE evidence_id=:id AND (:admin OR"
                          + " organization_id=:org)",
                      new HashMap<>() {
                        {
                          put("id", id);
                          put("admin", viewer.admin());
                          put("org", viewer.organizationId);
                        }
                      })
                  > 0;
      if (!scopedStaff) throw ApiException.forbidden();
    }
    return bytes(record.get("storage_key").toString());
  }

  public byte[] bytes(String key) throws IOException {
    return s3 == null
        ? Files.readAllBytes(safe(key))
        : s3.getObjectAsBytes(GetObjectRequest.builder().bucket(bucket).key(key).build())
            .asByteArray();
  }

  public void write(String key, byte[] data) throws IOException {
    if (s3 == null) Files.write(safe(key), data, StandardOpenOption.CREATE_NEW);
    else
      s3.putObject(
          PutObjectRequest.builder().bucket(bucket).key(key).contentType("image/jpeg").build(),
          RequestBody.fromBytes(data));
  }

  private void delete(String key) throws IOException {
    if (s3 == null) Files.deleteIfExists(safe(key));
    else s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
  }

  private Path safe(String key) {
    if (!key.matches("[a-f0-9-]{36}\\.jpg")) throw new ApiException(400, "Invalid evidence key");
    return path.resolve(key);
  }
}
