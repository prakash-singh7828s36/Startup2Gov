import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Calendar,
  Building2,
  MapPin,
  ArrowRight,
  Filter,
  Bookmark,
  BookmarkCheck,
  Sparkles,
  ArrowDownUp,
  GitCompareArrows,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { getChallenges } from "../../services/challengeService.js";
import { getProfile } from "../../services/startupService.js";
import { fetchChallenges } from "../../api/challengeApi.js";
import { fetchMyProfile } from "../../api/profileApi.js";
import { rankChallenges, checkEligibility } from "../../services/matching.js";
import { deadlineBadge } from "../../services/deadlines.js";
import { getBookmarks, toggleBookmark } from "../../services/bookmarks.js";
import { challengeCategories } from "../../data/challenges.js";
import { ErrorBanner } from "../../components/feedback.jsx";
import { canUseDemoFallback } from "../../services/demoMode.js";

const SORTS = [
  { id: "match", label: "Best match" },
  { id: "deadline", label: "Closing soon" },
  { id: "newest", label: "Newest" },
];

function matchTone(score) {
  if (score >= 75) return "high";
  if (score >= 50) return "mid";
  return "low";
}

function urgencyTone(urgency) {
  if (urgency === "urgent") return "urgent";
  if (urgency === "soon") return "soon";
  if (urgency === "closed") return "closed";
  return "open";
}

function BrowseChallenges() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [challenges, setChallenges] = useState([]);
  const [profile, setProfile] = useState(null);
  const [saved, setSaved] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("match");
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [compareIds, setCompareIds] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      let list = null;
      let prof = null;

      try {
        const [resList, resProf] = await Promise.all([
          fetchChallenges(),
          user?.id ? fetchMyProfile().catch(() => null) : Promise.resolve(null),
        ]);
        if (resList?.challenges?.length) {
          list = resList.challenges;
        }
        if (resProf?.profile) {
          prof = resProf.profile;
        }
      } catch (apiErr) {
        if (!canUseDemoFallback("challenge browse", apiErr)) {
          throw new Error("Unable to load challenges from the backend. Please try again later.", { cause: apiErr });
        }
      }

      const [fallbackList, fallbackProf, marks] = await Promise.all([
        list ? Promise.resolve(list) : (canUseDemoFallback("challenge browse fallback", "backend challenge lookup failed") ? getChallenges() : []),
        prof ? Promise.resolve(prof) : (user?.id && canUseDemoFallback("profile load fallback", "backend profile lookup failed") ? getProfile(user?.id) : null),
        getBookmarks(user?.id),
      ]);

      setChallenges(fallbackList);
      setProfile(fallbackProf);
      setSaved(marks);
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

  const ranked = useMemo(() => {
    if (!challenges.length) return [];
    return rankChallenges(profile || {}, challenges);
  }, [challenges, profile]);

  const results = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let list = ranked.filter(({ challenge }) => {
      const haystack = [
        challenge.title,
        challenge.department,
        challenge.location,
        challenge.category,
        ...(challenge.tags || []),
      ]
        .join(" ")
        .toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (category !== "All" && challenge.category !== category) return false;
      if (savedOnly && !saved.includes(challenge.id)) return false;
      if (eligibleOnly && !checkEligibility(profile || {}, challenge).eligible)
        return false;
      return true;
    });
    if (sort === "match") {
      // ranked already sorted by score
    } else if (sort === "deadline") {
      list = [...list].sort(
        (a, b) =>
          new Date(a.challenge.deadlineDate) - new Date(b.challenge.deadlineDate)
      );
    } else if (sort === "newest") {
      list = [...list].sort(
        (a, b) => new Date(b.challenge.postedDate) - new Date(a.challenge.postedDate)
      );
    }
    return list;
  }, [ranked, searchTerm, category, sort, eligibleOnly, savedOnly, saved, profile]);

  const handleBookmark = async (e, id) => {
    e.stopPropagation();
    const next = await toggleBookmark(user?.id, id);
    setSaved(next);
  };

  const toggleCompare = (id) => {
    setCompareIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 3
          ? prev
          : [...prev, id]
    );
  };

  const compareItems = compareIds
    .map((id) => ranked.find((r) => r.challenge.id === id))
    .filter(Boolean);

  return (
    <div style={{ margin: "-32px", padding: 32 }} className="challenges-page">
      <div className="challenges-header">
        <div>
          <h1>Browse Government Challenges</h1>
          <p>
            Ranked for {profile?.startupName || user?.startupName || "your startup"}
            {profile?.industry ? ` · ${profile.industry}` : ""} — match scores explain why.
          </p>
        </div>
      </div>

      <ErrorBanner message={error} onRetry={load} />

      <div className="challenge-filters">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search title, department, tags, location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="category-filter">
          <Filter size={18} />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {challengeCategories.map((c) => (
              <option key={c} value={c}>
                {c === "All" ? "All Categories" : c}
              </option>
            ))}
          </select>
        </div>
        <div className="category-filter">
          <ArrowDownUp size={18} />
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="browse-toggles">
        <button
          className={`toggle-chip ${eligibleOnly ? "on" : ""}`}
          onClick={() => setEligibleOnly((v) => !v)}
        >
          <Sparkles size={15} />
          Eligible for me
        </button>
        <button
          className={`toggle-chip ${savedOnly ? "on" : ""}`}
          onClick={() => setSavedOnly((v) => !v)}
        >
          <Bookmark size={15} />
          Saved ({saved.length})
        </button>
        {(eligibleOnly || savedOnly || searchTerm || category !== "All") && (
          <button
            className="toggle-chip clear"
            onClick={() => {
              setEligibleOnly(false);
              setSavedOnly(false);
              setSearchTerm("");
              setCategory("All");
            }}
          >
            <X size={15} />
            Clear
          </button>
        )}
      </div>

      <div className="challenge-results">
        <h2>Available Challenges</h2>
        <span>{loading ? "Loading..." : `${results.length} challenges found`}</span>
      </div>

      {loading ? (
        <div className="challenge-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="challenge-card skeleton-card" key={i}>
              <div className="sk sk-line short" />
              <div className="sk sk-line" />
              <div className="sk sk-line" />
              <div className="sk sk-line long" />
            </div>
          ))}
        </div>
      ) : (
        <div className="challenge-grid">
          {results.length > 0 ? (
            results.map(({ challenge, score, reasons }) => {
              const badge = deadlineBadge(challenge);
              const isSaved = saved.includes(challenge.id);
              const inCompare = compareIds.includes(challenge.id);
              return (
                <div className="challenge-card" key={challenge.id}>
                  <div className="challenge-card-header">
                    <span className="category-badge">{challenge.category}</span>
                    <span className={`deadline urg-${urgencyTone(badge.urgency)}`}>
                      <Calendar size={15} />
                      {badge.label}
                    </span>
                  </div>
                  <div className={`match-row tone-${matchTone(score)}`}>
                    <Sparkles size={15} />
                    <strong>{score}% match</strong>
                    <span>{reasons[0] || "Complete profile for better matches"}</span>
                  </div>
                  <h3>{challenge.title}</h3>
                  <div className="challenge-info">
                    <p>
                      <Building2 size={17} />
                      {challenge.department}
                    </p>
                    <p>
                      <MapPin size={17} />
                      {challenge.location}
                      {challenge.budget ? ` · ${challenge.budget}` : ""}
                    </p>
                  </div>
                  <p className="challenge-description">{challenge.description}</p>
                  <div className="card-actions">
                    <button
                      className="details-button"
                      onClick={() => navigate(`/challenges/${challenge.id}`)}
                    >
                      View Details
                      <ArrowRight size={18} />
                    </button>
                    <div className="card-icon-row">
                      <button
                        className={`icon-btn ${isSaved ? "active" : ""}`}
                        title={isSaved ? "Saved" : "Save for later"}
                        onClick={(e) => handleBookmark(e, challenge.id)}
                      >
                        {isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                      </button>
                      <button
                        className={`icon-btn ${inCompare ? "active" : ""}`}
                        title={inCompare ? "Remove from compare" : "Add to compare (max 3)"}
                        onClick={() => toggleCompare(challenge.id)}
                      >
                        <GitCompareArrows size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="no-results">
              <Search size={40} />
              <h3>No challenges found</h3>
              <p>Try changing your search, filters, or sort.</p>
            </div>
          )}
        </div>
      )}

      {compareIds.length > 0 && !compareOpen && (
        <div className="compare-tray">
          <span>
            <GitCompareArrows size={17} /> {compareIds.length} selected
          </span>
          <button className="primary-button" onClick={() => setCompareOpen(true)}>
            Compare now
          </button>
          <button className="secondary-button" onClick={() => setCompareIds([])}>
            Clear
          </button>
        </div>
      )}

      {compareOpen && (
        <div className="compare-overlay" onClick={() => setCompareOpen(false)}>
          <div className="compare-modal" onClick={(e) => e.stopPropagation()}>
            <div className="compare-modal-header">
              <h2>Compare challenges</h2>
              <button className="icon-btn" onClick={() => setCompareOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="compare-table-wrap">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th></th>
                    {compareItems.map(({ challenge }) => (
                      <th key={challenge.id}>{challenge.title}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Match</td>
                    {compareItems.map(({ challenge, score }) => (
                      <td key={challenge.id}>
                        <strong>{score}%</strong>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>Department</td>
                    {compareItems.map(({ challenge }) => (
                      <td key={challenge.id}>{challenge.department}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>Budget</td>
                    {compareItems.map(({ challenge }) => (
                      <td key={challenge.id}>{challenge.budget || "—"}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>Duration</td>
                    {compareItems.map(({ challenge }) => (
                      <td key={challenge.id}>{challenge.duration || "—"}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>Deadline</td>
                    {compareItems.map(({ challenge }) => (
                      <td key={challenge.id}>
                        {challenge.deadline} ({deadlineBadge(challenge).label})
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>Location</td>
                    {compareItems.map(({ challenge }) => (
                      <td key={challenge.id}>{challenge.location}</td>
                    ))}
                  </tr>
                  <tr>
                    <td></td>
                    {compareItems.map(({ challenge }) => (
                      <td key={challenge.id}>
                        <button
                          className="details-button"
                          onClick={() => navigate(`/challenges/${challenge.id}`)}
                        >
                          View
                          <ArrowRight size={16} />
                        </button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BrowseChallenges;
