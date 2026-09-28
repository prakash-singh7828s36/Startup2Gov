import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  PlusCircle,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Search,
  FileStack,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { getGovChallengesByOwner, setChallengeStatus, deleteChallenge } from "../../services/govChallengeService.js";
import {
  fetchOwnedGovChallenges,
  updateGovChallengeStatus,
  deleteGovChallenge,
} from "../../api/challengeApi.js";
import { getApplicationsForGov } from "../../services/applicationService.js";
import { urgencyLabel } from "../../services/deadlines.js";
import { Loading, ErrorBanner } from "../../components/feedback.jsx";
import { canUseDemoFallback } from "../../services/demoMode.js";

function GovChallenges() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [challenges, setChallenges] = useState([]);
  const [appCounts, setAppCounts] = useState({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      let mine = null;
      try {
        const apiOwned = await fetchOwnedGovChallenges();
        if (Array.isArray(apiOwned)) {
          mine = apiOwned;
        }
      } catch (apiErr) {
        if (!canUseDemoFallback("gov challenges load", apiErr)) {
          throw new Error("Unable to load your challenges from the backend.", { cause: apiErr });
        }
      }

      if (!mine) {
        mine = await getGovChallengesByOwner(user?.id);
      }

      setChallenges(mine);
      const apps = canUseDemoFallback("gov challenge app counts fallback", "backend application count lookup failed")
        ? await getApplicationsForGov({ ownedChallengeIds: mine.map((c) => c.id) })
        : [];
      const counts = {};
      apps.forEach((a) => {
        counts[a.challengeId] = (counts[a.challengeId] || 0) + 1;
      });
      setAppCounts(counts);
    } catch (e) {
      setError(e.message || "Failed to load challenges.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return challenges.filter((c) => {
      const okStatus =
        statusFilter === "All" || (c.status || "Open") === statusFilter;
      const okSearch =
        !q ||
        c.title.toLowerCase().includes(q) ||
        (c.department || "").toLowerCase().includes(q) ||
        (c.category || "").toLowerCase().includes(q);
      return okStatus && okSearch;
    });
  }, [challenges, search, statusFilter]);

  const handleToggle = async (c) => {
    setBusyId(c.id);
    const targetStatus = c.status === "Closed" ? "Open" : "Closed";
    try {
      let next = null;
      try {
        next = await updateGovChallengeStatus(c.id, targetStatus);
      } catch (apiErr) {
        if (!canUseDemoFallback("gov challenge status", apiErr)) {
          throw new Error("Status update could not be saved in the backend.", { cause: apiErr });
        }
        next = await setChallengeStatus(c.id, user?.id, targetStatus);
      }
      setChallenges((prev) =>
        prev.map((x) =>
          x.id === c.id || Number(x.id) === Number(c.id)
            ? { ...x, ...(next || {}), status: targetStatus }
            : x
        )
      );
    } catch (e) {
      setError(e.message || "Failed to update status.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete "${c.title}"? Startups will no longer see it.`)) return;
    setBusyId(c.id);
    try {
      try {
        await deleteGovChallenge(c.id);
      } catch (apiErr) {
        if (!canUseDemoFallback("gov challenge delete", apiErr)) {
          throw new Error("Challenge deletion could not complete in the backend.", { cause: apiErr });
        }
        await deleteChallenge(c.id, user?.id);
      }
      setChallenges((prev) =>
        prev.filter((x) => x.id !== c.id && Number(x.id) !== Number(c.id))
      );
    } catch (e) {
      setError(e.message || "Failed to delete challenge.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ margin: -32 }} className="challenges-page">
      <div className="challenges-header" style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <button className="back-button" onClick={() => navigate("/gov/dashboard")}>
            <ArrowLeft size={16} />
            Dashboard
          </button>
          <h1 style={{ marginTop: 12 }}>My Challenges</h1>
          <p>Create, edit, close and track applications per challenge.</p>
        </div>
        <button className="primary-button" onClick={() => navigate("/gov/challenges/new")}>
          <PlusCircle size={16} />
          New Challenge
        </button>
      </div>

      <ErrorBanner message={error} onRetry={load} />

      <div className="challenge-filters">
        <div className="search-box">
          <Search size={18} />
          <input
            placeholder="Search your challenges..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="category-filter">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All statuses</option>
            <option value="Open">Open</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <Loading label="Loading challenges..." />
      ) : filtered.length === 0 ? (
        <div className="no-results">
          <FileStack size={40} />
          <h3>{challenges.length === 0 ? "No challenges yet" : "No matches"}</h3>
          <p>
            {challenges.length === 0
              ? "Publish your first challenge — startups see it in Browse instantly."
              : "Try a different search or status filter."}
          </p>
          {challenges.length === 0 && (
            <button
              className="details-button"
              style={{ maxWidth: 260, margin: "18px auto 0" }}
              onClick={() => navigate("/gov/challenges/new")}
            >
              Create Challenge
            </button>
          )}
        </div>
      ) : (
        <div className="challenge-grid">
          {filtered.map((c) => (
            <div className="challenge-card" key={c.id}>
              <div className="challenge-card-header">
                <span className="category-badge">{c.category}</span>
                <span className={`status ${c.status === "Closed" ? "closed" : "approved"}`}>
                  {c.status || "Open"}
                </span>
              </div>
              <h3>{c.title}</h3>
              <p className="challenge-info" style={{ marginBottom: 12 }}>
                <span className="deadline">{urgencyLabel(c)}</span>
                <span> · {appCounts[c.id] || 0} application(s)</span>
              </p>
              <p className="challenge-description">
                {(c.description || "").slice(0, 140)}
                {(c.description || "").length > 140 ? "…" : ""}
              </p>
              <div className="card-actions" style={{ flexWrap: "wrap" }}>
                <button
                  className="details-button"
                  onClick={() => navigate(`/gov/applications?challenge=${c.id}`)}
                >
                  View applications
                </button>
                <div className="card-icon-row">
                  <button
                    className="icon-btn"
                    title="Edit"
                    onClick={() => navigate(`/gov/challenges/${c.id}/edit`)}
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    className="icon-btn"
                    title={c.status === "Closed" ? "Reopen" : "Close"}
                    disabled={busyId === c.id}
                    onClick={() => handleToggle(c)}
                  >
                    {c.status === "Closed" ? <Eye size={17} /> : <EyeOff size={17} />}
                  </button>
                  <button
                    className="icon-btn"
                    title="Delete"
                    disabled={busyId === c.id}
                    onClick={() => handleDelete(c)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default GovChallenges;
