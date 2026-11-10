package com.roadsaathi;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.roadsaathi.ai.AiService;
import com.roadsaathi.report.ReportService;
import com.roadsaathi.report.Types.Status;
import com.roadsaathi.security.Tokens;
import org.junit.jupiter.api.Test;

class SafetyRulesTest {
  @Test
  void reportCannotSkipHumanReview() {
    assertFalse(ReportService.transitionAllowed(Status.PENDING_REVIEW, Status.RESOLVED));
    assertTrue(ReportService.transitionAllowed(Status.PENDING_REVIEW, Status.VERIFIED));
    assertFalse(ReportService.transitionAllowed(Status.REJECTED, Status.ASSIGNED));
  }

  @Test
  void completionAndReopeningHaveExplicitTransitions() {
    assertTrue(ReportService.transitionAllowed(Status.IN_PROGRESS, Status.RESOLVED));
    assertFalse(ReportService.transitionAllowed(Status.VERIFIED, Status.RESOLVED));
    assertTrue(ReportService.transitionAllowed(Status.RESOLVED, Status.VERIFIED));
  }

  @Test
  void invalidModelResultsAreRejected() throws Exception {
    var json = new ObjectMapper();
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AiService.validate(
                json.readTree("{\"severity\":\"CRITICAL\",\"confidence_level\":0.99}")));
  }

  @Test
  void strictPreliminaryAssessmentIsAccepted() throws Exception {
    var n =
        new ObjectMapper()
            .readTree(
                "{\"road_damage_detected\":true,\"damage_type\":\"POTHOLE\",\"severity\":\"HIGH\",\"confidence_level\":\"MEDIUM\",\"description\":\"Visible"
                    + " surface depression.\",\"visible_risk_factors\":[\"Surface"
                    + " damage\"],\"requires_human_review\":true}");
    assertDoesNotThrow(() -> AiService.validate(n));
  }

  @Test
  void sessionSecretsAreRandomAndStoredHashed() {
    String a = Tokens.random(), b = Tokens.random();
    assertNotEquals(a, b);
    assertEquals(64, Tokens.hash(a).length());
    assertNotEquals(a, Tokens.hash(a));
  }

  @Test
  void weakSigningKeysFailClosed() {
    assertThrows(IllegalStateException.class, () -> new Tokens("weak"));
  }
}
