import { useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowRight,
  Check,
  LockKeyhole,
  Route,
  ShieldCheck,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth, useConfig } from "../app/context";
import { Logo, Field, ErrorState } from "../components/ui";
import { post } from "../lib/api";
const schema = z.object({
  name: z.string(),
  email: z.email("Enter a valid email"),
  password: z.string().min(10, "Use at least 10 characters").max(72),
});
type Values = z.infer<typeof schema>;
export default function Auth({
  mode = "login",
}: {
  mode?: "login" | "register" | "forgot" | "reset";
}) {
  const { login, register: registerUser } = useAuth();
  const { data: config } = useConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [error, setError] = useState<unknown>();
  const [message, setMessage] = useState("");
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: mode === "reset" ? "reset@roadsaathi.local" : "",
      password: mode === "forgot" ? "unused-password" : "",
    },
  });
  const onSubmit = async (v: Values) => {
    setError(undefined);
    try {
      if (mode === "forgot") {
        const r = await post<{ message: string }>("/auth/forgot-password", {
          email: v.email,
        });
        setMessage(r.message);
        return;
      }
      if (mode === "reset") {
        const r = await post<{ message: string }>("/auth/reset-password", {
          token: params.get("token"),
          password: v.password,
        });
        setMessage(r.message);
        return;
      }
      if (mode === "register" && !v.name.trim()) {
        setError(new Error("Enter your full name"));
        return;
      }
      const user =
        mode === "register"
          ? await registerUser(v.name, v.email, v.password)
          : await login(v.email, v.password);
      const target = location.state?.from;
      const redirect =
        typeof target === "string" &&
        target.startsWith("/") &&
        !target.startsWith("//")
          ? target
          : user.role === "SUPER_ADMIN"
            ? "/admin"
            : user.role === "MUNICIPAL_OFFICER"
              ? "/municipal"
              : "/dashboard";
      navigate(redirect, { replace: true });
    } catch (e) {
      setError(e);
    }
  };
  const titles = {
    login: "Welcome back.",
    register: "Safer roads start with you.",
    forgot: "Let’s get you back in.",
    reset: "A fresh start.",
  };
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <Logo light />
        <div>
          <span className="eyebrow">A BETTER WAY FORWARD</span>
          <h1>
            A little care.
            <br />A safer road.
            <br />
            <em>A better city.</em>
          </h1>
          <p>
            Join the people making every journey through Ludhiana a little
            safer.
          </p>
          <div className="auth-road">
            <Route size={150} strokeWidth={0.7} />
          </div>
          <div className="row">
            <ShieldCheck size={24} />
            <span>
              Community powered.
              <br />
              Human verified.
            </span>
          </div>
        </div>
        <small>Smarter Roads. Safer Journeys.</small>
      </aside>
      <main className="auth-main">
        <Link className="back-link" to="/">
          ← Back to RoadSaathi
        </Link>
        <div className="auth-form-wrap">
          <span className="auth-icon">
            <LockKeyhole size={23} />
          </span>
          <h1>{titles[mode]}</h1>
          {import.meta.env.VITE_PHONE_TEST === "true" && (
            <p className="notice">
              Wi-Fi test app: keep your phone and Mac on the same Wi-Fi and run
              “Start Phone Test” on the Mac. Server:{" "}
              {import.meta.env.VITE_API_BASE_URL}
            </p>
          )}
          <p>
            {mode === "login"
              ? "Sign in to your RoadSaathi account."
              : mode === "register"
                ? "Create your free citizen account to report and track road hazards."
                : "We’ll help you securely update your password."}
          </p>
          {message ? (
            <div className="success-panel">
              <Check size={28} />
              <p>{message}</p>
              <Link to="/login" className="button primary">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {mode === "register" && (
                <Field label="Full name" error={errors.name?.message}>
                  <input
                    {...register("name")}
                    autoComplete="name"
                    placeholder="Your full name"
                    maxLength={100}
                  />
                </Field>
              )}
              {mode !== "reset" && (
                <Field label="Email address" error={errors.email?.message}>
                  <input
                    {...register("email")}
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </Field>
              )}
              {mode !== "forgot" && (
                <Field
                  label={mode === "reset" ? "New password" : "Password"}
                  error={errors.password?.message}
                  hint={mode === "register" ? "At least 10 characters." : ""}
                >
                  <input
                    {...register("password")}
                    type="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    placeholder="Enter your password"
                  />
                </Field>
              )}
              {mode === "login" && (
                <Link to="/forgot-password" className="forgot-link">
                  Forgot password?
                </Link>
              )}
              {error != null && <ErrorState error={error} />}
              <button
                disabled={isSubmitting}
                className="button primary full"
                type="submit"
              >
                {isSubmitting
                  ? "Please wait…"
                  : mode === "login"
                    ? "Sign in"
                    : mode === "register"
                      ? "Create account"
                      : mode === "forgot"
                        ? "Send reset link"
                        : "Update password"}
                <ArrowRight size={18} />
              </button>
            </form>
          )}
          {mode === "login" && (
            <p className="auth-switch">
              New to RoadSaathi? <Link to="/register">Create an account</Link>
            </p>
          )}
          {mode === "register" && (
            <p className="auth-switch">
              Already a contributor? <Link to="/login">Sign in</Link>
            </p>
          )}
          {config?.demoMode && mode === "login" && (
            <div className="demo-accounts">
              <span>EXPLORE THE DEMO WORKSPACE</span>
              <div>
                {["Citizen", "Officer", "Admin"].map((role) => (
                  <button
                    type="button"
                    key={role}
                    onClick={() => {
                      setValue(
                        "email",
                        role.toLowerCase() + "@roadsaathi.demo",
                      );
                      setValue("password", "RoadDemo!2026");
                    }}
                  >
                    {role}
                  </button>
                ))}
              </div>
              <small>Fills development credentials. Sign in to continue.</small>
            </div>
          )}
          <p className="legal-note">
            By continuing, you agree to our <Link to="/terms">terms</Link> and{" "}
            <Link to="/privacy">privacy policy</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
