package com.roadsaathi.storage;

import com.roadsaathi.security.Identity;
import java.io.IOException;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/evidence")
public class EvidenceController {
  private final EvidenceService storage;
  private final Identity identity;

  public EvidenceController(EvidenceService s, Identity i) {
    storage = s;
    identity = i;
  }

  @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  @ResponseStatus(HttpStatus.CREATED)
  Map<String, Object> upload(@RequestPart("image") MultipartFile image) throws IOException {
    return storage.upload(image, identity.user());
  }

  @GetMapping("/{id}")
  ResponseEntity<byte[]> get(@PathVariable UUID id) throws IOException {
    return ResponseEntity.ok()
        .contentType(MediaType.IMAGE_JPEG)
        .header("Cache-Control", "private, no-store")
        .header("X-Content-Type-Options", "nosniff")
        .body(storage.read(id, identity.optional()));
  }
}
