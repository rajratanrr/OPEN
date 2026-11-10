package com.roadsaathi.report;

public class Types {
  public enum Damage {
    POTHOLE,
    CRACK,
    SURFACE_DAMAGE,
    WATERLOGGING,
    OTHER_HAZARD,
    NO_VISIBLE_DAMAGE,
    UNCERTAIN
  }

  public enum Severity {
    LOW,
    MEDIUM,
    HIGH,
    CRITICAL,
    UNKNOWN
  }

  public enum Status {
    PENDING_REVIEW,
    VERIFIED,
    ASSIGNED,
    IN_PROGRESS,
    RESOLVED,
    REJECTED
  }

  public enum Confidence {
    LOW,
    MEDIUM,
    HIGH
  }
}
