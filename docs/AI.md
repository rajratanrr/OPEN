# Optional AI integration

AI is intentionally disconnected in this delivery. Manual reporting and human review work without an API key. No live model request or paid AI validation was performed.

`AiService` implements `POST /api/v1/ai/analyze-road-image` through the OpenAI Responses API. It requires a signed-in image owner and explicit consent. Evidence is normalized to a bounded JPEG before upload. The key remains on the Spring server; the browser never receives it.

The strict JSON schema contains:

```json
{
  "road_damage_detected": true,
  "damage_type": "POTHOLE",
  "severity": "HIGH",
  "confidence_level": "MEDIUM",
  "description": "Illustrative schema example only; not an assessment.",
  "visible_risk_factors": ["Illustrative visible observation"],
  "requires_human_review": true
}
```

This example documents the shape; it is never served as a generated result. Allowed categories also include cracks, surface damage, waterlogging, other hazards, no visible damage and uncertainty. Confidence is qualitative, not a calibrated probability. Exact dimensions and depth cannot be established from a single uncalibrated photo.

A missing key, timeout, refusal, malformed response, unsupported enum or provider failure returns `UNAVAILABLE` with `result: null`. The UI preserves manual category/severity controls. Analysis metadata records the model, status, latency and token usage when available. Images containing instructions are treated as untrusted evidence. The request sets `store: false`; the deployment operator should review the provider's current data handling terms before enabling third-party processing.

To enable later, set `OPENAI_API_KEY` and `OPENAI_VISION_MODEL` in the backend environment and restart it. Keep the key out of Git, logs, frontend bundles and screenshots. Then verify a suitable road image, an unrelated image, an unclear image, a provider failure and a consent refusal. Review outputs with a human before public use.

The implementation follows [OpenAI structured-output documentation](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) and the [Responses API reference](https://developers.openai.com/api/reference/resources/responses/methods/create). Model availability must be checked when connecting your account.

AI chat, description summarization, duplicate-image comparison and a separately trained object detector are deferred. The project does not simulate these services.
