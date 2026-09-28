import { Link } from "react-router-dom";
import {
  Landmark,
  Sun,
  Moon,
  ArrowRight,
  ArrowUpRight,
  User,
  Sparkles,
  Send,
  Wallet,
  Calendar,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext.jsx";
import { challenges } from "../data/challenges.js";
import { DEMO_MODE } from "../services/demoMode.js";

const STEPS = [
  {
    n: "01",
    icon: <User size={24} />,
    title: "Complete your profile",
    text: "Stage, team, tech tags and DPIIT — everything feeds your match accuracy.",
  },
  {
    n: "02",
    icon: <Sparkles size={24} />,
    title: "Get matched & checked",
    text: "Every challenge scores 0–100 with reasons, plus an eligibility checklist.",
  },
  {
    n: "03",
    icon: <Send size={24} />,
    title: "Apply & track",
    text: "Autosaving wizard, calendar deadlines, timelines and one-click exports.",
  },
];

const WEIGHTS = [
  { label: "Industry fit", pts: 30 },
  { label: "Keyword overlap", pts: 30 },
  { label: "Profile strength", pts: 20 },
  { label: "Stage fit", pts: 10 },
  { label: "Team readiness", pts: 10 },
];

const DEPARTMENTS = [
  "Urban Development",
  "Transport",
  "Health",
  "Agriculture",
  "Education",
  "Energy",
  "Finance",
  "Water & Sanitation",
  "Grievance Cell",
];

function Landing() {
  const { theme, toggle } = useTheme();
  const featured = challenges.filter((c) => c.featured).slice(0, 3);

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-logo">
          <span className="landing-logo-mark">
            <Landmark size={18} strokeWidth={2.4} />
          </span>
          Startup2Gov
        </div>
        <nav className="landing-links">
          <a href="#how">How it works</a>
          <a href="#challenges">Challenges</a>
          <a href="#engine">Match engine</a>
        </nav>
        <div className="landing-nav-actions">
          <button
            className="theme-toggle"
            onClick={toggle}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <Link to="/login" className="landing-ghost">
            Sign in
          </Link>
          <Link to="/signup" className="landing-cta">
            Get started <ArrowRight size={16} />
          </Link>
          <Link to="/login" className="landing-ghost" title={DEMO_MODE ? "Government demo: demo@gov.in / password123" : "Government sign-in"}>
            Govt login
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <span className="landing-kicker">
          <span className="landing-dot" />
          Sample demo · 12 live challenges · No backend needed
        </span>
        <h1>
          Govt challenges,
          <br />
          <span className="hl">matched</span> to your startup.
        </h1>
        <p>
          Stop scrolling tender PDFs. Complete one profile, get a 0–100 fit score
          with reasons for every challenge, clear eligibility checks, and a
          tracker that never loses your work.
        </p>
        <div className="landing-hero-actions">
          <Link to="/signup" className="landing-cta big">
            Find your match <ArrowRight size={18} />
          </Link>
          <a href="#challenges" className="landing-ghost big">
            See challenges <ArrowUpRight size={18} />
          </a>
        </div>
        <div className="landing-stats">
          <div>
            <strong>{challenges.length}</strong>
            <span>Live challenges</span>
          </div>
          <div>
            <strong>{new Set(challenges.map((c) => c.department)).size}</strong>
            <span>Departments</span>
          </div>
          <div>
            <strong>₹10–30L</strong>
            <span>Pilot grants</span>
          </div>
          <div>
            <strong>0–100</strong>
            <span>Match scoring</span>
          </div>
        </div>
      </section>

      <div className="landing-ticker">
        <div className="landing-ticker-track">
          {[...DEPARTMENTS, ...DEPARTMENTS].map((d, i) => (
            <span key={i}>
              {d} <i>◆</i>
            </span>
          ))}
        </div>
      </div>

      <section className="landing-section" id="how">
        <h2>How it works</h2>
        <p className="landing-section-sub">Three steps. Zero tender PDFs.</p>
        <div className="landing-steps">
          {STEPS.map((s) => (
            <div className="landing-step" key={s.n}>
              <span className="landing-step-num">{s.n}</span>
              <div className="landing-step-icon">{s.icon}</div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section" id="challenges">
        <h2>Featured challenges</h2>
        <p className="landing-section-sub">
          Real deadlines, budgets and requirements — sample data, full flow.
        </p>
        <div className="landing-cards">
          {featured.map((c) => (
            <div className="landing-card" key={c.id}>
              <span className="category-badge">{c.category}</span>
              <h3>{c.title}</h3>
              <p className="landing-card-meta">
                <MapPin size={14} /> {c.location} · {c.department}
              </p>
              <p className="landing-card-meta">
                <Wallet size={14} /> {c.budget} · {c.duration}
              </p>
              <p className="landing-card-meta">
                <Calendar size={14} /> Deadline {c.deadline}
              </p>
              <Link to="/signup" className="landing-ghost wide">
                Sign up to apply <ArrowRight size={15} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section" id="engine">
        <h2>The match engine</h2>
        <p className="landing-section-sub">
          Transparent scoring — every number shows its reasons.
        </p>
        <div className="landing-engine">
          {WEIGHTS.map((w) => (
            <div className="landing-weight" key={w.label}>
              <span>{w.label}</span>
              <div className="score-bar">
                <div className="score-fill" style={{ width: `${w.pts * 3}%` }} />
              </div>
              <strong>{w.pts}</strong>
            </div>
          ))}
        </div>
        <p className="landing-note">
          <ShieldCheck size={15} /> Missing info never blocks you — it shows up as
          a nudge to complete your profile.
        </p>
      </section>

      <section className="landing-cta-band">
        <h2>Stop scrolling tenders. Start matching.</h2>
        <p>One profile. Twelve challenges. Your next pilot is waiting.</p>
        <Link to="/signup" className="landing-cta big inverted">
          Create free account <ArrowRight size={18} />
        </Link>
      </section>

      <footer className="landing-footer">
        <span>Startup2Gov · Startup + Government modules · Sample demo data</span>
        <span>
          <Link to="/login">Sign in</Link> · <Link to="/signup">Sign up</Link>
          {DEMO_MODE && <> · Govt demo: demo@gov.in / password123</>}
        </span>
      </footer>
    </div>
  );
}

export default Landing;
