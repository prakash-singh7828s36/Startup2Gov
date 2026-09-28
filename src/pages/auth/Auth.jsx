import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { User, Mail, Lock, Landmark, Sun, Moon, ArrowRight, Building2, Briefcase } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";
import { dashboardForRole } from "../../api/authApi.js";
import { DEMO_MODE } from "../../services/demoMode.js";

function AuthForm({ mode }) {
  const isLogin = mode === "login";
  const { login, signup } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState("startup");
  const [form, setForm] = useState({
    startupName: "",
    orgName: "",
    designation: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isGov = role === "government";

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.email.trim() || !form.password) {
      setError("Email and password are required.");
      return;
    }
    if (!isLogin) {
      if (!isGov && !form.startupName.trim()) {
        setError("Startup name is required.");
        return;
      }
      if (isGov && !form.orgName.trim()) {
        setError("Organisation / department is required.");
        return;
      }
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters (demo rule).");
      return;
    }
    setBusy(true);
    try {
      let nextUser;
      if (isLogin) {
        nextUser = await login({ email: form.email, password: form.password });
      } else {
        nextUser = await signup({
          role,
          startupName: form.startupName,
          orgName: form.orgName,
          department: form.orgName,
          designation: form.designation,
          email: form.email,
          password: form.password,
        });
      }
      // Shared login: honour return-to only when the role matches,
      // otherwise send each role to its own dashboard.
      const from = location.state?.from;
      const fromIsGov = typeof from === "string" && from.startsWith("/gov");
      const roleIsGov = nextUser?.role === "government";
      const dest =
        from && fromIsGov === roleIsGov
          ? from
          : dashboardForRole(nextUser?.role);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <button
        className="auth-theme-toggle"
        onClick={toggle}
        title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      >
        {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        {theme === "dark" ? "LIGHT" : "DARK"}
      </button>

      <div className="auth-card">
        <div className="auth-logo">
          <Landmark size={22} strokeWidth={2.4} />
        </div>
        <h1 className="auth-title">
          {isLogin ? "Welcome back" : "Create your account"}
        </h1>
        <p className="auth-sub">
          {isLogin
            ? "Jump back into your pipeline."
            : isGov
              ? "Publish challenges and review startup applications."
              : "Start managing your govt applications today."}
        </p>

        <div className="role-toggle" role="tablist" aria-label="Account type">
          <button
            type="button"
            role="tab"
            aria-selected={!isGov}
            className={!isGov ? "on" : ""}
            onClick={() => setRole("startup")}
          >
            <User size={15} />
            Startup
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isGov}
            className={isGov ? "on" : ""}
            onClick={() => setRole("government")}
          >
            <Building2 size={15} />
            Government
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {!isLogin && !isGov && (
            <div className="auth-field">
              <label htmlFor="startupName">
                <User size={15} />
                Startup name
              </label>
              <input
                id="startupName"
                name="startupName"
                placeholder="Smart Waste AI"
                value={form.startupName}
                onChange={handleChange}
                autoComplete="organization"
              />
            </div>
          )}

          {!isLogin && isGov && (
            <>
              <div className="auth-field">
                <label htmlFor="orgName">
                  <Building2 size={15} />
                  Organisation / department
                </label>
                <input
                  id="orgName"
                  name="orgName"
                  placeholder="Urban Development Department"
                  value={form.orgName}
                  onChange={handleChange}
                  autoComplete="organization"
                />
              </div>
              <div className="auth-field">
                <label htmlFor="designation">
                  <Briefcase size={15} />
                  Designation (optional)
                </label>
                <input
                  id="designation"
                  name="designation"
                  placeholder="Nodal Officer"
                  value={form.designation}
                  onChange={handleChange}
                  autoComplete="organization-title"
                />
              </div>
            </>
          )}

          <div className="auth-field">
            <label htmlFor="email">
              <Mail size={15} />
              Email address
            </label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="name@example.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">
              <Lock size={15} />
              Password
            </label>
            <input
              id="password"
              type="password"
              name="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? "Please wait..." : isLogin ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="auth-switch">
          {isLogin ? (
            <Link to="/signup">
              New here? Create an account <ArrowRight size={15} />
            </Link>
          ) : (
            <Link to="/login">
              Already have an account? Sign in <ArrowRight size={15} />
            </Link>
          )}
        </div>
      </div>

      <p className="auth-demo">
        <Link to="/">← Back to home</Link>
        {DEMO_MODE && (
          <> · Demo startup: demo@startup.in / password123 · Demo govt: demo@gov.in / password123 · mock auth, data stays in this browser</>
        )}
      </p>
    </div>
  );
}

export function Login() {
  return <AuthForm mode="login" />;
}

export function Signup() {
  return <AuthForm mode="signup" />;
}
