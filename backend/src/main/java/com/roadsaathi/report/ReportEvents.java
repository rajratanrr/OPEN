package com.roadsaathi.report;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Component
public class ReportEvents {
  public record Changed(UUID id) {}

  private final List<SseEmitter> connections = new CopyOnWriteArrayList<>();

  public SseEmitter connect() {
    var e = new SseEmitter(300000L);
    if (connections.size() >= 500)
      throw new com.roadsaathi.common.ApiException(
          503, "Live updates are busy; polling remains available");
    connections.add(e);
    e.onCompletion(() -> connections.remove(e));
    e.onTimeout(() -> connections.remove(e));
    e.onError(x -> connections.remove(e));
    send(e, "connected", Map.of("ready", true));
    return e;
  }

  @TransactionalEventListener
  public void changed(Changed event) {
    for (var e : connections) send(e, "reports", Map.of("reportId", event.id()));
  }

  @Scheduled(fixedRate = 25000)
  void heartbeat() {
    for (var e : connections) send(e, "heartbeat", Map.of("time", System.currentTimeMillis()));
  }

  private void send(SseEmitter e, String name, Object data) {
    try {
      e.send(SseEmitter.event().name(name).data(data));
    } catch (IOException | IllegalStateException x) {
      connections.remove(e);
      e.complete();
    }
  }
}
