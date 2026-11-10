import { newId } from "../lib/id";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CloudUpload,
  Crosshair,
  ImagePlus,
  MapPin,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { useAuth, useConfig, useOnline, useToast } from "../app/context";
import { api, post, queryString, upload } from "../lib/api";
import { saveDraft } from "../lib/offline";
import { getLocation } from "../lib/device";
import { HazardMap } from "../components/HazardMap";
import {
  Badge,
  ErrorState,
  Field,
  PageHeading,
  Panel,
  Steps,
} from "../components/ui";
import type { Analysis, Page, RoadReport, ReportInput } from "../types";
import { damages, label, severities } from "../types";
const formSchema = z.object({
  roadName: z.string().trim().min(3, "Enter the road name").max(180),
  description: z
    .string()
    .trim()
    .min(10, "Add at least 10 characters of detail")
    .max(3000),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  damageType: z.enum(damages),
  severity: z.enum(severities),
});
type FormValues = z.infer<typeof formSchema>;
export default function ReportWizard() {
  const { user } = useAuth();
  const { data: config } = useConfig();
  const online = useOnline();
  const toast = useToast();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [locationSet, setLocationSet] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [analysis, setAnalysis] = useState<Analysis>();
  const [evidenceId, setEvidenceId] = useState<string>();
  const [consent, setConsent] = useState(false);
  const requestId = useRef(newId());
  const {
    register,
    watch,
    setValue,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      roadName: "",
      description: "",
      latitude: 30.901,
      longitude: 75.8573,
      damageType: "POTHOLE",
      severity: "UNKNOWN",
    },
  });
  const lat = watch("latitude"),
    lng = watch("longitude"),
    type = watch("damageType");
  const duplicates = useQuery({
    queryKey: ["duplicates", lat, lng, type],
    queryFn: () =>
      api<Page<RoadReport>>(
        "/reports/nearby?" +
          queryString({
            latitude: lat,
            longitude: lng,
            radius:
              (config?.detection.duplicateRadiusMeters || 20) +
              Math.min(gpsAccuracy || 0, 50),
            damageType: type,
            unresolved: true,
            pageSize: 5,
          }),
      ),
    enabled: step > 0 && locationSet && online,
  });
  useEffect(() => {
    if (!photo) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const choose = (file?: File) => {
    if (!file) return;
    if (
      !["image/jpeg", "image/png"].includes(file.type) ||
      file.size > 8 * 1024 * 1024
    ) {
      setError(new Error("Choose a JPEG or PNG image smaller than 8 MB."));
      return;
    }
    setError(undefined);
    setPhoto(file);
    setEvidenceId(undefined);
    setAnalysis(undefined);
  };
  const locate = async () => {
    setLocating(true);
    try {
      const p = await getLocation();
      setValue("latitude", p.coords.latitude);
      setValue("longitude", p.coords.longitude);
      setGpsAccuracy(p.coords.accuracy);
      setLocationSet(true);
    } catch {
      setError(
        new Error(
          "Location permission was not granted. Set a map pin or enter coordinates instead.",
        ),
      );
    } finally {
      setLocating(false);
    }
  };
  const getEvidence = async () => {
    if (evidenceId) return evidenceId;
    if (!photo) throw new Error("Add a photograph first.");
    const result = await upload(photo);
    setEvidenceId(result.id);
    return result.id;
  };
  const analyze = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const id = await getEvidence();
      const a = await post<Analysis>("/ai/analyze-road-image", {
        evidenceId: id,
        consent,
      });
      setAnalysis(a);
      if (a.result) {
        setValue("damageType", a.result.damage_type);
        setValue("severity", a.result.severity);
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const validate = async () => {
    if (!photo) {
      setError(new Error("Add a road photograph to continue."));
      return false;
    }
    if (!locationSet) {
      setError(
        new Error(
          "Choose the report’s location using the map, coordinates, or GPS.",
        ),
      );
      return false;
    }
    return trigger();
  };
  const input = (): Omit<ReportInput, "evidenceId"> => ({
    ...getValues(),
    clientRequestId: requestId.current,
    gpsAccuracyMeters: gpsAccuracy,
    aiAnalysisId: analysis?.id || null,
  });
  const save = async () => {
    setError(undefined);
    if (!(await validate())) return;
    try {
      await saveDraft({
        id: requestId.current,
        ownerId: user!.id,
        image: photo!,
        input: input(),
        evidenceId,
        createdAt: new Date().toISOString(),
      });
      toast(
        "Report saved on this device. It will remain in your outbox until synced.",
      );
      navigate("/my-reports");
    } catch (e) {
      setError(e);
    }
  };
  const submit = async () => {
    setError(undefined);
    if (!(await validate())) return;
    if (!online) {
      await save();
      return;
    }
    setBusy(true);
    try {
      const eid = await getEvidence();
      const r = await post<RoadReport>("/reports", {
        ...input(),
        evidenceId: eid,
      });
      await client.invalidateQueries();
      toast("Your report was saved and sent for review.");
      navigate("/reports/" + r.id);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const next = async () => {
    setError(undefined);
    if (await validate()) setStep((s) => s + 1);
  };
  return (
    <>
      <PageHeading
        eyebrow="MAKE YOUR CARE COUNT"
        title="A better road starts here."
        description="Share what you see. We’ll help your city follow it through."
      />
      <div className="wizard-layout">
        <section className="panel wizard-panel">
          <Steps
            labels={["Photo & location", "Review assessment", "Submit report"]}
            active={step}
          />
          {error != null && <ErrorState error={error} />}
          {step === 0 && (
            <>
              <div className="wizard-title">
                <span>01</span>
                <div>
                  <h2>Show us what needs attention.</h2>
                  <p>
                    Take a clear photo from a safe place, then choose the exact
                    location.
                  </p>
                </div>
              </div>
              <label
                className={"photo-drop " + (preview ? "has-photo" : "")}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  choose(e.dataTransfer.files[0]);
                }}
              >
                {preview ? (
                  <>
                    <img src={preview} alt="Your selected road photograph" />
                    <span className="replace-photo">
                      <Camera size={16} />
                      Change photo
                    </span>
                  </>
                ) : (
                  <>
                    <span className="upload-icon">
                      <ImagePlus size={30} />
                    </span>
                    <strong>Drop your road photo here</strong>
                    <span>or click to capture or upload</span>
                    <small>
                      JPEG or PNG · Up to 8 MB · No more than 20 megapixels
                    </small>
                  </>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  capture="environment"
                  aria-label="Road photograph"
                  onChange={(e) => choose(e.target.files?.[0])}
                />
              </label>
              <div className="form-grid">
                <Field
                  label="Road or landmark"
                  error={errors.roadName?.message}
                >
                  <input
                    {...register("roadName")}
                    placeholder="e.g. Ferozepur Road, near the market"
                  />
                </Field>
                <Field label="Damage category">
                  <select {...register("damageType")}>
                    {damages.map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field
                label="What did you notice?"
                error={errors.description?.message}
              >
                <textarea
                  {...register("description")}
                  rows={3}
                  placeholder="Describe the visible damage and a nearby landmark. Avoid including personal information."
                />
              </Field>
              <div className="location-heading">
                <div>
                  <h3>
                    <MapPin size={18} />
                    Pin the location
                  </h3>
                  <p>
                    Click the map or enter coordinates. A starting map position
                    is not your GPS location.
                  </p>
                </div>
                <button
                  type="button"
                  className="button secondary small-button"
                  disabled={locating}
                  onClick={locate}
                >
                  <Crosshair size={16} />
                  {locating ? "Locating…" : "Use my location"}
                </button>
              </div>
              <HazardMap
                height={260}
                selected={locationSet ? [lat, lng] : undefined}
                focus={locationSet ? [lat, lng] : undefined}
                onPick={(a, b) => {
                  setValue("latitude", Number(a.toFixed(6)));
                  setValue("longitude", Number(b.toFixed(6)));
                  setGpsAccuracy(null);
                  setLocationSet(true);
                }}
              />
              <div className="form-grid coordinate-fields">
                <Field label="Latitude" error={errors.latitude?.message}>
                  <input
                    type="number"
                    step="any"
                    {...register("latitude", {
                      valueAsNumber: true,
                      onChange: () => {
                        setLocationSet(true);
                        setGpsAccuracy(null);
                      },
                    })}
                  />
                </Field>
                <Field label="Longitude" error={errors.longitude?.message}>
                  <input
                    type="number"
                    step="any"
                    {...register("longitude", {
                      valueAsNumber: true,
                      onChange: () => {
                        setLocationSet(true);
                        setGpsAccuracy(null);
                      },
                    })}
                  />
                </Field>
              </div>
              {gpsAccuracy != null && (
                <small className="muted">
                  GPS accuracy: ±{Math.round(gpsAccuracy)} m. Check the pin
                  before continuing.
                </small>
              )}
            </>
          )}
          {step === 1 && (
            <>
              <div className="wizard-title">
                <span>02</span>
                <div>
                  <h2>A little intelligence. Your final say.</h2>
                  <p>
                    Review the classification and choose the severity you
                    observed.
                  </p>
                </div>
              </div>
              <div className="analysis-layout">
                <img
                  className="analysis-photo"
                  src={preview}
                  alt="Road photograph to review"
                />
                <div className="analysis-box">
                  <Sparkles size={26} />
                  <h3>Preliminary AI assessment</h3>
                  {config?.aiEnabled ? (
                    <>
                      <p>
                        With your consent, a normalized copy of this photograph
                        is sent to OpenAI for analysis.
                      </p>
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={consent}
                          onChange={(e) => setConsent(e.target.checked)}
                        />
                        I consent to AI image analysis.
                      </label>
                      <button
                        className="button primary"
                        disabled={!consent || busy || !online}
                        onClick={analyze}
                      >
                        {busy ? "Analyzing…" : "Analyze photograph"}
                        <Sparkles size={16} />
                      </button>
                    </>
                  ) : (
                    <p>
                      AI is not connected yet. Your photo can still be reviewed
                      by a municipal officer.
                    </p>
                  )}
                  {analysis && (
                    <div className="analysis-result">
                      <p>{analysis.message}</p>
                      {analysis.result && (
                        <>
                          <Badge value={analysis.result.severity} />
                          <p>{analysis.result.description}</p>
                          <small>
                            Confidence:{" "}
                            {label(analysis.result.confidence_level)}
                          </small>
                          <ul>
                            {analysis.result.visible_risk_factors.map((f) => (
                              <li key={f}>{f}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-grid">
                <Field label="Damage category">
                  <select {...register("damageType")}>
                    {damages.map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Observed severity"
                  hint="Choose Unknown if you’re unsure. The city will verify it."
                >
                  <select {...register("severity")}>
                    {severities.map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="notice">
                <ShieldCheck size={19} />
                <p>
                  A photograph cannot establish exact depth or physical
                  dimensions. Every report starts as unverified.
                </p>
              </div>
              {!!duplicates.data?.items.length && (
                <div className="duplicates">
                  <h3>Could this be the same hazard?</h3>
                  <p>
                    Nearby reports with the same category. Confirm an existing
                    report, or continue if this is a separate hazard.
                  </p>
                  {duplicates.data.items.map((r) => (
                    <div className="duplicate-row" key={r.id}>
                      <div>
                        <strong>{r.roadName}</strong>
                        <small>
                          {label(r.status)}
                          {r.isDemo ? " · Demo" : ""}
                        </small>
                      </div>
                      <button
                        className="button secondary small-button"
                        onClick={async () => {
                          try {
                            await post("/reports/" + r.id + "/confirm");
                            await client.invalidateQueries();
                            toast("Your confirmation was saved.");
                            navigate("/reports/" + r.id);
                          } catch (e) {
                            setError(e);
                          }
                        }}
                      >
                        Confirm existing
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <div className="wizard-title">
                <span>03</span>
                <div>
                  <h2>Ready to make a difference?</h2>
                  <p>Your report will go to the municipal review queue.</p>
                </div>
              </div>
              <img
                className="review-photo"
                src={preview}
                alt="Evidence included in your report"
              />
              <div className="review-summary">
                <div className="row between">
                  <h2>{watch("roadName")}</h2>
                  <Badge value={watch("severity")} />
                </div>
                <p>{watch("description")}</p>
                <div className="review-meta">
                  <span>
                    <MapPin size={16} />
                    {lat.toFixed(5)}, {lng.toFixed(5)}
                  </span>
                  <span>{label(watch("damageType"))}</span>
                  <span>
                    <ShieldCheck size={16} />
                    Pending human review
                  </span>
                </div>
              </div>
              <div className="notice">
                <Check size={18} />
                <p>
                  Your photo, location, and description will be visible on the
                  public map. Your email and personal travel history will not be
                  published.
                </p>
              </div>
            </>
          )}
          <div className="wizard-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                step > 0 ? setStep((s) => s - 1) : navigate("/dashboard")
              }
            >
              <ArrowLeft size={17} />
              {step ? "Back" : "Cancel"}
            </button>
            <div className="row">
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={save}
              >
                <CloudUpload size={17} />
                Save to outbox
              </button>
              {step < 2 ? (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={next}
                >
                  Continue
                  <ArrowRight size={17} />
                </button>
              ) : (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={submit}
                >
                  {busy
                    ? "Submitting…"
                    : online
                      ? "Submit report"
                      : "Save offline"}
                  <ArrowRight size={17} />
                </button>
              )}
            </div>
          </div>
        </section>
        <aside className="wizard-tips">
          <Panel>
            <span className="tip-icon">
              <Camera size={25} />
            </span>
            <h3>
              A helpful report starts
              <br />
              with a helpful photo.
            </h3>
            <ul>
              <li>Show the damage and a little of the surrounding road.</li>
              <li>Photograph from a safe, stationary position.</li>
              <li>Keep faces and number plates out of the frame.</li>
              <li>Include a landmark to help the repair team find it.</li>
            </ul>
            <div className="tip-footer">
              <ShieldCheck size={18} />
              <span>Human review, every time.</span>
            </div>
          </Panel>
          <div className="offline-tip">
            <CloudUpload size={21} />
            <h4>Poor connection?</h4>
            <p>
              Save to your outbox. Your image and report stay on this device
              until you sync successfully.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
