import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Activity,
  Camera,
  Check,
  ChevronRight,
  MapPin,
  ShieldCheck,
  Sparkles,
  Trophy,
  Wrench,
  Route,
  HeartHandshake,
} from "lucide-react";
import { motion } from "framer-motion";
import { Logo, ErrorState } from "../components/ui";
import { HazardMap } from "../components/HazardMap";
import { api } from "../lib/api";
import { useConfig, useAuth } from "../app/context";
import type { Page, RoadReport, Summary } from "../types";
export default function Landing() {
  const { user } = useAuth();
  const { data: config } = useConfig();
  const summary = useQuery({
    queryKey: ["public-summary"],
    queryFn: () => api<Summary>("/analytics/public-summary"),
  });
  const { data: reports } = useQuery({
    queryKey: ["landing-map"],
    queryFn: () =>
      api<Page<RoadReport>>(
        "/reports/map?south=30.8&north=31&west=75.75&east=76&pageSize=50",
      ),
  });
  const features = [
    {
      icon: Camera,
      title: "A photo. A first step.",
      text: "Capture road damage, add a location, and send a report that your city can act on.",
    },
    {
      icon: Sparkles,
      title: "Intelligence with oversight.",
      text: "Optional AI assesses visible damage. Every assessment stays preliminary until human review.",
    },
    {
      icon: MapPin,
      title: "Know what lies ahead.",
      text: "Explore reported hazards and receive proximity alerts during an enabled journey.",
    },
    {
      icon: Wrench,
      title: "Follow every repair.",
      text: "See your report move from review to repair, with evidence and a clear status timeline.",
    },
    {
      icon: Activity,
      title: "Let the road speak.",
      text: "Supported motion sensors flag possible bumps during foreground monitoring.",
    },
    {
      icon: HeartHandshake,
      title: "Better roads, together.",
      text: "Confirm hazards, earn contribution points, and help build a more informed community.",
    },
  ];
  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <nav>
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <Link to="/map">Live map</Link>
          <a href="#impact">Our impact</a>
        </nav>
        <div className="row">
          <Link className="login-link" to={user ? "/dashboard" : "/login"}>
            {user ? "Dashboard" : "Sign in"}
          </Link>
          <Link
            className="button primary small-button"
            to={user ? "/report" : "/register"}
          >
            Get started <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      <section className="hero">
        <div className="hero-grid-lines" />
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="live-dot" /> BUILT FOR LUDHIANA. READY FOR EVERY
            CITY.
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Every pothole
            <br />
            reported.
            <br />
            <em>Every road safer.</em>
          </motion.h1>
          <p>
            Better journeys start with all of us. Report road hazards, help your
            city take action, and see the difference you make.
          </p>
          <div className="hero-buttons">
            <Link className="button mint" to="/report">
              Report a pothole <ArrowUpRight size={19} />
            </Link>
            <Link className="button hero-secondary" to="/map">
              Explore the map <ArrowRight size={18} />
            </Link>
          </div>
          <div className="hero-proof">
            <span>
              <Check size={15} /> Free for citizens
            </span>
            <span>
              <Check size={15} /> Every report tracked
            </span>
            <span>
              <Check size={15} /> Human verified
            </span>
          </div>
        </div>
        <motion.div
          className="hero-map-scene"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="hero-map-card">
            <div className="hero-map-bar">
              <span>
                <span className="live-dot" /> ROAD CONDITIONS
              </span>
              <small>
                Ludhiana, Punjab <MapPin size={13} />
              </small>
            </div>
            <HazardMap reports={reports?.items || []} compact height={390} />
            <div className="hero-map-bottom">
              <span>
                <i className="dot teal" />
                Resolved
              </span>
              <span>
                <i className="dot orange" />
                Reported hazard
              </span>
              <Link to="/map">
                Open live map <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>
          <div className="floating-insight">
            <div className="insight-icon">
              <ShieldCheck size={23} />
            </div>
            <div>
              <small>FROM REPORT TO REPAIR</small>
              <strong>{summary.data?.resolved ?? "—"} reports resolved</strong>
              <span>
                {config?.demoMode
                  ? "Includes clearly labeled demo records"
                  : "Based on recorded repair updates"}
              </span>
            </div>
            <span className="small-check">
              <Check size={15} />
            </span>
          </div>
          <div className="hero-map-caption">
            <span className="caption-line" />
            {config?.demoMode
              ? "Demonstration workspace · Sample hazards shown"
              : "Map data from community reports"}
          </div>
        </motion.div>
      </section>
      <section id="impact" className="impact-strip">
        <div className="impact-intro">
          <span className="eyebrow">SMALL ACTIONS. SHARED IMPACT.</span>
          <h2>
            A safer city,
            <br />
            one report at a time.
          </h2>
        </div>
        {summary.error ? (
          <ErrorState error={summary.error} />
        ) : (
          <div className="impact-numbers">
            {[
              { name: "Community reports", value: summary.data?.total },
              {
                name: "Verified active hazards",
                value: summary.data?.verified,
              },
              { name: "Repairs completed", value: summary.data?.resolved },
              {
                name: "Active contributors",
                value: summary.data?.contributors,
              },
            ].map((s) => (
              <div key={s.name}>
                <strong>{s.value ?? "—"}</strong>
                <span>{s.name}</span>
              </div>
            ))}
          </div>
        )}
        {config?.demoMode && (
          <small className="impact-footnote">
            Demonstration data is included in these database totals.
          </small>
        )}
      </section>
      <section id="features" className="landing-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">YOUR CITY. YOUR ROADSAATHI.</span>
            <h2>
              Good roads take
              <br />a connected community.
            </h2>
          </div>
          <p>
            A simple way for citizens and city teams to work together, from the
            first report to the final repair.
          </p>
        </div>
        <div className="feature-grid">
          {features.map(({ icon: Icon, title, text }, i) => (
            <article key={title}>
              <div className="row between">
                <span className="feature-icon">
                  <Icon size={23} />
                </span>
                <small>0{i + 1}</small>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section id="how-it-works" className="workflow-section">
        <div>
          <span className="eyebrow">A CLEAR PATH TO BETTER ROADS</span>
          <h2>
            Report it. Track it.
            <br />
            See the change.
          </h2>
          <p>
            No lost complaints. Just a shared record of what needs attention and
            what happens next.
          </p>
          <Link to="/report" className="text-link">
            Make your first report <ArrowRight size={18} />
          </Link>
        </div>
        <div className="workflow">
          {["Detect", "Analyze", "Verify", "Assign", "Repair", "Confirm"].map(
            (s, i) => (
              <div key={s}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <b>{s}</b>
                <small>
                  {
                    [
                      "Take a photo and pin the location",
                      "Optional, preliminary AI assessment",
                      "A city officer reviews the evidence",
                      "The city assigns a repair",
                      "Progress and evidence are recorded",
                      "The public timeline reflects the outcome",
                    ][i]
                  }
                </small>
                {i < 5 && <ChevronRight size={17} />}
              </div>
            ),
          )}
        </div>
      </section>
      <section className="landing-cta">
        <Route size={40} />
        <h2>
          Your next report could
          <br />
          make someone’s journey safer.
        </h2>
        <Link to="/report" className="button mint">
          Be part of the change <ArrowUpRight size={18} />
        </Link>
      </section>
      <footer className="landing-footer">
        <Logo />
        <p>Smarter Roads. Safer Journeys.</p>
        <div>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/about">About & contact</Link>
        </div>
        <small>
          RoadSaathi is not an emergency service. Report only from a safe
          location.
        </small>
      </footer>
    </div>
  );
}
