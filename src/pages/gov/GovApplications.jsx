import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Calendar,
  FileText,
  Search,
  X,
  CheckCircle,
  Clock,
  XCircle,
  ScrollText,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAuth } from "../../context/AuthContext.jsx";
import { getChallenges } from "../../services/challengeService.js";
import { getGovChallengesByOwner } from "../../services/govChallengeService.js";
import {
  APPLICATION_STATUSES,
  REVIEW_TRANSITIONS,
  getApplicationsForGov,
  updateApplicationStatus,
} from "../../services/applicationService.js";
import {
  fetchGovInbox,
  reviewApplication as apiReviewApplication,
} from "../../api/applicationApi.js";
import { applicationTimeline } from "../../services/activity.js";
import { Loading, ErrorBanner, Toast } from "../../components/feedback.jsx";
import { canUseDemoFallback } from "../../services/demoMode.js";

function fmtDate(at) {
  if (!at) return "—";
  try {
    return format(parseISO(String(at)), "d MMM yyyy");
  } catch {
    return String(at);
  }
}

function statusPill(status) {
  const cls = status.toLowerCase().replace(/\s+/g, "-");
  const Icon = status === "Approved" ? CheckCircle : status === "Rejected" ? XCircle : Clock;
  return (
    <span className={`application-status ${cls}`}>
      <Icon size={15} />
      {status}
    </span>
  );
}

function ReviewDrawer({ app, challenges, onClose, onSaved }) {
  const { user } = useAuth();
  const [status, setStatus] = useState(app?.status || "Pending");
  const [note, setNote] = useState(app?.reviewNote || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(app?.status || "Pending");
    setNote(app?.reviewNote || "");
    setErr("");
  }, [app?.id, app?.status, app?.reviewNote]);

  if (!app) return null;
  const timeline = applicationTimeline(app);
  const allowed = REVIEW_TRANSITIONS[app.status] || APPLICATION_STATUSES;
  const challenge = challenges.find((c) => Number(c.id) === Number(app.challengeId));

  const handleSave = async () => {
    setErr("");
    setSaving(true);
    try {
      let next = null;
      try {
        next = await apiReviewApplication(app.id, { status, note });
      } catch (apiErr) {
        if (!canUseDemoFallback("gov review update", apiErr)) {
          throw new Error("Review update could not be saved in the backend.", { cause: apiErr });
        }
        next = await updateApplicationStatus({
          reviewerId: user?.id,
          applicationId: app.id,
          status,
          note,
        });
      }
      onSaved(next);
    } catch (e) {
      setErr(e.message || "Failed to update status.");
    } finally {
      setSaving(false);
    }
  };

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
        {statusPill(app.status)}

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

        <h3 className="drawer-h">Applicant</h3>
        <dl className="review-list">
          <div>
            <dt>Startup</dt>
            <dd>{app.startupName || "—"}</dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>{app.contactPerson || "—"}</dd>
          </div>
          <div>
            <dt>Solution</dt>
            <dd>{app.solution || "—"}</dd>
          </div>
          <div>
            <dt>Technology</dt>
            <dd>{app.technology || "—"}</dd>
          </div>
          <div>
            <dt>Submitted</dt>
            <dd>{app.submittedOn || fmtDate(app.createdAt)}</dd>
          </div>
          <div>
            <dt>Document</dt>
            <dd>{app.document?.name || "None attached"}</dd>
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
        {challenge && (
          <>
            <h3 className="drawer-h">Challenge context</h3>
            <p className="drawer-p">
              {challenge.department} · {challenge.budget} · Deadline{" "}
              {challenge.deadline}
            </p>
          </>
        )}

        <h3 className="drawer-h">Review decision</h3>
        <div className="browse-toggles" style={{ marginBottom: 12 }}>
          {APPLICATION_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={`toggle-chip ${status === s ? "on" : ""}`}
              title={
                allowed.includes(s)
                  ? `Set status to ${s}`
                  : `Current status is ${app.status}`
              }
              onClick={() => setStatus(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="form-group">
          <label htmlFor="reviewNote">Reviewer note (visible in startup timeline)</label>
          <textarea
            id="reviewNote"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Strong pilot plan — shortlisted for field demo."
          />
        </div>
        {err && <div className="auth-error" style={{ marginTop: 12 }}>{err}</div>}

        <div className="drawer-actions">
          <button className="primary-button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save review"}
          </button>
          <button className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function GovApplications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [applications, setApplications] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const challengeFilter = params.get("challenge") || "All";
  const statusFilter = params.get("status") || "All";
  const search = params.get("q") || "";
  const selectedId = params.get("selected") || "";

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (!v || v === "All" || v === "") next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [owned, allChallenges] = await Promise.all([
        getGovChallengesByOwner(user?.id),
        getChallenges(),
      ]);
      setMine(owned);
      setChallenges(allChallenges);
      let apps = null;
      try {
        const inboxData = await fetchGovInbox({
          challengeId: challengeFilter !== "All" ? challengeFilter : undefined,
          status: statusFilter !== "All" ? statusFilter : undefined,
        });
        if (Array.isArray(inboxData?.applications)) {
          apps = inboxData.applications;
        }
      } catch (apiErr) {
        if (!canUseDemoFallback("gov inbox load", apiErr)) {
          throw new Error("Unable to load the applications inbox from the backend.", { cause: apiErr });
        }
      }
      if (!apps) {
        apps = await getApplicationsForGov({
          ownedChallengeIds: owned.map((c) => c.id),
        });
      }
      setApplications(apps);
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

  const challengeOptions = useMemo(() => {
    const map = new Map();
    challenges.forEach((c) => map.set(Number(c.id), c.title));
    applications.forEach((a) => {
      if (!map.has(Number(a.challengeId))) map.set(Number(a.challengeId), a.challenge);
    });
    return [...map.entries()].map(([id, title]) => ({ id, title }));
  }, [challenges, applications]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications.filter((a) => {
      const okChallenge =
        challengeFilter === "All" || Number(a.challengeId) === Number(challengeFilter);
      const okStatus = statusFilter === "All" || a.status === statusFilter;
      const okSearch =
        !q ||
        (a.challenge || "").toLowerCase().includes(q) ||
        (a.solution || "").toLowerCase().includes(q) ||
        (a.startupName || "").toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q);
      return okChallenge && okStatus && okSearch;
    });
  }, [applications, challengeFilter, statusFilter, search]);

  const counts = useMemo(() => {
    const by = (s) => applications.filter((a) => a.status === s).length;
    return {
      total: applications.length,
      pending: by("Pending"),
      underReview: by("Under Review"),
      approved: by("Approved"),
      rejected: by("Rejected"),
    };
  }, [applications]);

  const selected = selectedId
    ? applications.find((a) => a.id === selectedId) || null
    : null;

  const handleSaved = (next) => {
    setApplications((prev) => prev.map((a) => (a.id === next.id ? next : a)));
    setToast(`${next.id} moved to ${next.status}. Startup sees it instantly.`);
    setParam("selected", "");
    window.setTimeout(() => setToast(""), 4000);
  };

  return (
    <div style={{ margin: -32 }} className="applications-page">
      <div className="applications-container">
        <div className="applications-header">
          <button className="back-button" onClick={() => navigate("/gov/dashboard")}>
            <ArrowLeft size={18} />
            Back to Dashboard
          </button>
          <h1>Applications</h1>
          <p>
            Review queue{mine.length > 0
              ? ` — showing applications across your ${mine.length} challenge(s) plus sample pipeline data`
              : " — sample pipeline data (publish a challenge to scope this to your postings)"}.
          </p>
        </div>

        <ErrorBanner message={error} onRetry={load} />
        <Toast message={toast} />

        <div className="application-summary" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <div className="summary-card">
            <div className="summary-icon">
              <FileText size={22} />
            </div>
            <div>
              <h3>{counts.total}</h3>
              <p>Total</p>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">
              <Clock size={22} />
            </div>
            <div>
              <h3>{counts.pending + counts.underReview}</h3>
              <p>Needs review</p>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">
              <CheckCircle size={22} />
            </div>
            <div>
              <h3>{counts.approved}</h3>
              <p>Approved</p>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">
              <XCircle size={22} />
            </div>
            <div>
              <h3>{counts.rejected}</h3>
              <p>Rejected</p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
          <div className="search-box" style={{ maxWidth: 340 }}>
            <Search size={18} />
            <input
              placeholder="Search startup, solution, ID..."
              value={search}
              onChange={(e) => setParam("q", e.target.value)}
            />
          </div>
          <select
            value={challengeFilter}
            onChange={(e) => setParam("challenge", e.target.value)}
            style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "0 12px", background: "white" }}
          >
            <option value="All">All challenges</option>
            {challengeOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setParam("status", e.target.value)}
            style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "0 12px", background: "white" }}
          >
            <option value="All">All statuses</option>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {(challengeFilter !== "All" || statusFilter !== "All" || search) && (
            <button
              className="toggle-chip clear"
              onClick={() => setParams({}, { replace: true })}
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="applications-list">
          <h2>
            {filtered.length} application{filtered.length === 1 ? "" : "s"}
          </h2>
          {loading ? (
            <Loading label="Loading applications..." />
          ) : filtered.length === 0 ? (
            <div className="no-results">
              <FileText size={40} />
              <h3>No applications found</h3>
              <p>Try a different search, challenge or status filter.</p>
            </div>
          ) : (
            filtered.map((a) => (
              <div className="application-card" key={a.id}>
                <div className="application-main">
                  <div className="application-title-row">
                    <div>
                      <span className="application-id">{a.id}</span>
                      <h3>{a.challenge}</h3>
                    </div>
                    {statusPill(a.status)}
                  </div>
                  <div className="application-info">
                    <div>
                      <FileText size={17} />
                      <span>
                        <strong>Solution:</strong> {a.solution || "—"}
                      </span>
                    </div>
                    <div>
                      <Building2 size={17} />
                      <span>
                        <strong>Startup:</strong> {a.startupName || "—"}
                        {a.contactPerson ? ` · ${a.contactPerson}` : ""}
                      </span>
                    </div>
                    <div>
                      <Calendar size={17} />
                      <span>
                        <strong>Submitted:</strong> {a.submittedOn || fmtDate(a.createdAt)}
                      </span>
                    </div>
                  </div>
                  {a.reviewNote && (
                    <p className="muted" style={{ marginTop: 10 }}>
                      Reviewer note: {a.reviewNote}
                    </p>
                  )}
                </div>
                <div className="application-actions">
                  <button className="view-button" onClick={() => setParam("selected", a.id)}>
                    <ScrollText size={17} />
                    Review
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ReviewDrawer
        app={selected}
        challenges={challenges}
        onClose={() => setParam("selected", "")}
        onSaved={handleSaved}
      />
    </div>
  );
}

export default GovApplications;
