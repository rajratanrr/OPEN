package com.roadsaathi.ai;

import com.roadsaathi.security.Identity;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/ai")
public class AiController {
  private final AiService ai;
  private final Identity identity;

  public AiController(AiService ai, Identity identity) {
    this.ai = ai;
    this.identity = identity;
  }

  record Request(@NotNull UUID evidenceId, boolean consent) {}

  @PostMapping("/analyze-road-image")
  Map<String, Object> analyze(@Valid @RequestBody Request r) throws Exception {
    return ai.analyze(r.evidenceId, r.consent, identity.user());
  }

  @GetMapping("/analyses/{id}")
  Map<String, Object> get(@PathVariable UUID id) throws Exception {
    return ai.get(id, identity.user());
  }
}
