import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Building2,
  FileText,
  Eye,
  Clock,
  CheckCircle,
  Search,
  Trash2,
  X,
  Download,
  ScrollText,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  getApplications,
  withdrawApplication,
} from "../../services/applicationService.js";
import {
  fetchMyApplications,
  withdrawApplication as apiWithdrawApplication,
} from "../../api/applicationApi.js";
import { applicationTimeline } from "../../services/activity.js";
import { Loading, ErrorBanner } from "../../components/feedback.jsx";
import { canUseDemoFallback } from "../../services/demoMode.js";

function fmtDate(at) {
  if (!at) return "—";
  try {
    return format(parseISO(String(at)), "d MMM yyyy");
  } catch {
    return String(at);
  }
}

function exportMarkdown(app) {
  const lines = [
    `# Application ${app.id} — ${app.challenge}`,
    "",
    `- Status: ${app.status}`,
    `- Solution: ${app.solution || "—"}`,
    `- Department: ${app.department || "—"}`,
    `- Submitted: ${app.submittedOn || fmtDate(app.createdAt)}`,
    `- Startup: ${app.startupName || "—"} (contact: ${app.contactPerson || "—"})`,
    `- Technology: ${app.technology || "—"}`,
    `- Document: ${app.document?.name || "None attached"}`,
    "",
    "## Solution description",
    "",
    app.solutionDescription || "_Not provided_",
    "",
    "## How it solves the challenge",
    "",
    app.challengeSolution || "_Not provided_",
    "",
    "## Expected impact",
    "",
    app.expectedImpact || "_Not provided_",
    "",
    "## Timeline",
    "",
    ...applicationTimeline(app).map((e) => `- ${e.label} — ${fmtDate(e.at)}${e.detail ? ` (${e.detail})` : ""}`),
    "",
    "_Exported from Startup2Gov (sample demo data)._",
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = `application-${app.id}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function DetailDrawer({ app, onClose, onWithdraw, onViewChallenge }) {
  if (!app) return null;
  const timeline = applicationTimeline(app);
  return (
    <div className="compare-overlay" onClick={onClose}>
      <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="compare-modal-header">
          <div>
            <span className="application-id">{app.id}</span>
            <h2>{app.challenge}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className={`application-status ${app.status.toLowerCase().replace(/\s+/g, "-")}`}>
          {app.status === "Approved" ? <CheckCircle size={16} /> : <Clock size={16} />}
          {app.status}
        </div>

        <h3 className="drawer-h">Timeline</h3>
        <ul className="drawer-timeline">
          {timeline.map((e) => (
            <li key={e.id}>
              <span className="activity-dot" />
              <div>
                <strong>{e.label}</strong>
                <span>
                  {fmtDate(e.at)}
                  {e.detail ? ` · ${e.detail}` : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <h3 className="drawer-h">Application details</h3>
        <dl className="review-list">
          <div>
            <dt>Solution</dt>
            <dd>{app.solution || "—"}</dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>{app.department || "—"}</dd>
          </div>
          <div>
            <dt>Submitted</dt>
            <dd>{app.submittedOn || fmtDate(app.createdAt)}</dd>
          </div>
          <div>
            <dt>Startup</dt>
            <dd>
              {[app.startupName, app.contactPerson].filter(Boolean).join(" · ") || "—"}
            </dd>
          </div>
          <div>
            <dt>Technology</dt>
            <dd>{app.technology || "—"}</dd>
          </div>
          <div>
            <dt>Document</dt>
            <dd>
              {app.document?.name
                ? `${app.document.name}${app.document.size ? ` (${Math.round(app.document.size / 1024)} KB)` : ""}`
                : "None attached"}
            </dd>
          </div>
        </dl>

        {app.solutionDescription && (
          <>
            <h3 className="drawer-h">Solution description</h3>
            <p className="drawer-p">{app.solutionDescription}</p>
          </>
        )}
        {app.challengeSolution && (
          <>
            <h3 className="drawer-h">How it solves the challenge</h3>
            <p className="drawer-p">{app.challengeSolution}</p>
          </>
        )}
        {app.expectedImpact && (
          <>
            <h3 className="drawer-h">Expected impact</h3>
            <p className="drawer-p">{app.expectedImpact}</p>
          </>
        )}

        <div className="drawer-actions">
          <button className="primary-button" onClick={() => onViewChallenge(app)}>
            <Eye size={16} />
            View Challenge
          </button>
          <button className="secondary-button" onClick={() => exportMarkdown(app)}>
            <Download size={16} />
            Export summary
          </button>
          <button className="secondary-button danger" onClick={() => onWithdraw(app.id)}>
            <Trash2 size={15} />
            Withdraw
          </button>
        </div>
      </div>
    </div>
  );
}

function MyApplications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      let list = null;
      try {
        const apiApps = await fetchMyApplications();
        if (Array.isArray(apiApps)) {
          list = apiApps;
        }
      } catch (apiErr) {
        if (!canUseDemoFallback("my applications", apiErr)) {
          throw new Error("Unable to load your applications from the backend.", { cause: apiErr });
        }
      }

      if (!list) {
        list = canUseDemoFallback("my applications fallback", "backend applications lookup failed")
          ? await getApplications(user?.id)
          : [];
      }
      setApplications(list);
    } catch (e) {
      setError(e.message || "Failed to load applications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleWithdraw = async (appId) => {
    if (!window.confirm(`Withdraw application ${appId}?`)) return;
    try {
      try {
        await apiWithdrawApplication(appId);
      } catch (apiErr) {
        if (!canUseDemoFallback("application withdrawal", apiErr)) {
          throw new Error("Withdrawal could not be completed in the backend.", { cause: apiErr });
        }
        await withdrawApplication(user?.id, appId);
      }
      setApplications((prev) => prev.filter((a) => a.id !== appId));
      setSelected(null);
    } catch (e) {
      setError(e.message || "Failed to withdraw application.");
    }
  };

  const getStatusClass = (status) => status.toLowerCase().replace(/\s+/g, "-");

  const getStatusIcon = (status) => {
    if (status === "Approved") return <CheckCircle size={18} />;
    return <Clock size={18} />;
  };

  const filtered = applications.filter((app) => {
    const okStatus = filter === "All" || app.status === filter;
    const q = search.toLowerCase();
    const okSearch =
      !q ||
      (app.challenge || "").toLowerCase().includes(q) ||
      (app.solution || "").toLowerCase().includes(q) ||
      app.id.toLowerCase().includes(q);
    return okStatus && okSearch;
  });

  const inProgress = applications.filter(
    (a) => a.status === "Pending" || a.status === "Under Review"
  ).length;
  const approved = applications.filter((a) => a.status === "Approved").length;

  return (
    <div style={{ margin: -32 }} className="applications-page">
      <div className="applications-container">
        <div className="applications-header">
          <button className="back-button" onClick={() => navigate("/dashboard")}>
            <ArrowLeft size={18} />
            Back to Dashboard
          </button>
          <h1>My Applications</h1>
          <p>Track the status of your applications submitted to government challenges.</p>
        </div>

        <ErrorBanner message={error} onRetry={load} />

        <div className="application-summary">
          <div className="summary-card">
            <div className="summary-icon">
              <FileText size={22} />
            </div>
            <div>
              <h3>{applications.length}</h3>
              <p>Total Applications</p>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">
              <Clock size={22} />
            </div>
            <div>
              <h3>{inProgress}</h3>
              <p>In Progress</p>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">
              <CheckCircle size={22} />
            </div>
            <div>
              <h3>{approved}</h3>
              <p>Approved</p>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <div className="search-box" style={{ maxWidth: 360 }}>
            <Search size={18} />
            <input
              placeholder="Search by challenge, solution, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "0 12px",
              background: "white",
            }}
          >
            <option value="All">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Under Review">Under Review</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        <div className="applications-list">
          <h2>Submitted Applications</h2>
          {loading ? (
            <Loading label="Loading applications..." />
          ) : filtered.length === 0 ? (
            <div className="no-results">
              <FileText size={40} />
              <h3>No applications found</h3>
              <p>
                {applications.length === 0
                  ? "You have not applied yet. Browse challenges to submit your first solution."
                  : "Try a different search or status filter."}
              </p>
              <button
                className="details-button"
                style={{ maxWidth: 260, margin: "18px auto 0" }}
                onClick={() => navigate("/challenges")}
              >
                Browse Challenges
              </button>
            </div>
          ) : (
            filtered.map((application) => (
              <div className="application-card" key={application.id}>
                <div className="application-main">
                  <div className="application-title-row">
                    <div>
                      <span className="application-id">{application.id}</span>
                      <h3>{application.challenge}</h3>
                    </div>
                    <div className={`application-status ${getStatusClass(application.status)}`}>
                      {getStatusIcon(application.status)}
                      {application.status}
                    </div>
                  </div>
                  <div className="application-info">
                    <div>
                      <FileText size={17} />
                      <span>
                        <strong>Solution:</strong> {application.solution}
                      </span>
                    </div>
                    <div>
                      <Building2 size={17} />
                      <span>
                        <strong>Department:</strong> {application.department}
                      </span>
                    </div>
                    <div>
                      <Calendar size={17} />
                      <span>
                        <strong>Submitted:</strong> {application.submittedOn}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="application-actions" style={{ gap: 8, flexWrap: "wrap" }}>
                  <button className="view-button" onClick={() => setSelected(application)}>
                    <ScrollText size={17} />
                    Details
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => navigate(`/challenges/${application.challengeId}`)}
                  >
                    <Eye size={15} />
                    Challenge
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => handleWithdraw(application.id)}
                    title="Withdraw (demo)"
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Trash2 size={15} />
                    Withdraw
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <DetailDrawer
        app={selected}
        onClose={() => setSelected(null)}
        onWithdraw={handleWithdraw}
        onViewChallenge={(app) => navigate(`/challenges/${app.challengeId}`)}
      />
    </div>
  );
}

export default MyApplications;
