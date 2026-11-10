package com.roadsaathi.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.time.Instant;
import java.util.Map;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice
public class Errors {
  @ExceptionHandler(Exception.class)
  ResponseEntity<?> handle(Exception e, HttpServletRequest request) {
    int status = 500;
    String message = "The request could not be completed. Please try again.";
    if (e instanceof ApiException a) {
      status = a.status;
      message = a.getMessage();
    } else if (e instanceof MethodArgumentNotValidException v) {
      status = 400;
      message =
          v.getBindingResult().getFieldErrors().stream()
              .map(x -> x.getField() + ": " + x.getDefaultMessage())
              .findFirst()
              .orElse("Invalid request");
    } else if (e instanceof ConstraintViolationException
        || e instanceof MethodArgumentTypeMismatchException
        || e instanceof HttpMessageNotReadableException
        || e instanceof IllegalArgumentException) {
      status = 400;
      message = "Invalid request. Check the supplied values.";
    } else if (e instanceof AccessDeniedException) {
      status = 403;
      message = "You do not have permission for this action";
    } else if (e instanceof MaxUploadSizeExceededException) {
      status = 413;
      message = "Images must be smaller than 8 MB";
    } else if (e instanceof DataIntegrityViolationException) {
      status = 409;
      message = "This action conflicts with an existing record";
    }
    if (status == 500)
      LoggerFactory.getLogger(Errors.class)
          .error(
              "Request failed: {} {} ({})",
              request.getMethod(),
              request.getRequestURI(),
              e.getClass().getSimpleName(),
              e);
    return ResponseEntity.status(status)
        .body(
            Map.of(
                "timestamp",
                Instant.now(),
                "status",
                status,
                "error",
                status == 400 ? "VALIDATION_ERROR" : "REQUEST_FAILED",
                "message",
                message,
                "path",
                request.getRequestURI()));
  }
}
