import { Component, lazy, Suspense } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, ToastProvider } from "./context";
import { Layout, Protected } from "./Layout";
import { Spinner } from "../components/ui";
const Landing = lazy(() => import("../features/Landing"));
const Auth = lazy(() => import("../features/Auth"));
const Dashboard = lazy(() => import("../features/Dashboard"));
const MapPage = lazy(() => import("../features/MapPage"));
const ReportList = lazy(() => import("../features/ReportList"));
const ReportWizard = lazy(() => import("../features/ReportWizard"));
const ReportDetail = lazy(() => import("../features/ReportDetail"));
const Monitor = lazy(() => import("../features/Monitor"));
const Analytics = lazy(() => import("../features/Analytics"));
const Settings = lazy(() => import("../features/Settings"));
const Admin = lazy(() => import("../features/Admin"));
const Info = lazy(() => import("../features/Info"));
const Notifications = lazy(() =>
  import("../features/Community").then((m) => ({ default: m.Notifications })),
);
const Rewards = lazy(() =>
  import("../features/Community").then((m) => ({ default: m.Rewards })),
);
const client = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 20000, retry: 1, refetchOnWindowFocus: true },
  },
});
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      "RoadSaathi rendering error",
      error.message,
      info.componentStack,
    );
  }
  render() {
    return this.state.failed ? (
      <div className="fatal-error">
        <h1>This page needs a fresh start.</h1>
        <p>
          Your submitted reports are safely stored on the server. Unsent drafts
          remain in your outbox.
        </p>
        <button
          className="button primary"
          onClick={() => window.location.reload()}
        >
          Reload RoadSaathi
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <Suspense fallback={<Spinner text="Opening RoadSaathi…" />}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Auth />} />
                  <Route path="/register" element={<Auth mode="register" />} />
                  <Route
                    path="/forgot-password"
                    element={<Auth mode="forgot" />}
                  />
                  <Route
                    path="/reset-password"
                    element={<Auth mode="reset" />}
                  />
                  {(["privacy", "terms", "about"] as const).map((kind) => (
                    <Route
                      key={kind}
                      path={"/" + kind}
                      element={<Info kind={kind} />}
                    />
                  ))}
                  <Route element={<Layout />}>
                    <Route path="/map" element={<MapPage />} />
                    <Route path="/reports/:id" element={<ReportDetail />} />
                    <Route element={<Protected />}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/report" element={<ReportWizard />} />
                      <Route path="/my-reports" element={<ReportList />} />
                      <Route path="/monitor" element={<Monitor />} />
                      <Route path="/rewards" element={<Rewards />} />
                      <Route
                        path="/notifications"
                        element={<Notifications />}
                      />
                      <Route path="/settings" element={<Settings />} />
                    </Route>
                    <Route
                      element={
                        <Protected
                          roles={["MUNICIPAL_OFFICER", "SUPER_ADMIN"]}
                        />
                      }
                    >
                      <Route
                        path="/municipal"
                        element={<Dashboard municipal />}
                      />
                      <Route
                        path="/municipal/reports"
                        element={<ReportList municipal />}
                      />
                      <Route path="/analytics" element={<Analytics />} />
                    </Route>
                    <Route element={<Protected roles={["SUPER_ADMIN"]} />}>
                      <Route path="/admin" element={<Admin />} />
                    </Route>
                  </Route>
                  <Route
                    path="*"
                    element={
                      <div className="fatal-error">
                        <h1>This road leads elsewhere.</h1>
                        <p>We couldn’t find that page.</p>
                        <Link to="/" className="button primary">
                          Back home
                        </Link>
                      </div>
                    }
                  />
                </Routes>
              </Suspense>
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
