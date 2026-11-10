package com.roadsaathi.common;

public class ApiException extends RuntimeException {
  public final int status;

  public ApiException(int status, String message) {
    super(message);
    this.status = status;
  }

  public static ApiException missing() {
    return new ApiException(404, "Record not found");
  }

  public static ApiException forbidden() {
    return new ApiException(403, "You do not have permission for this action");
  }
}
