import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Building2,
  MapPin,
  Tag,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Bookmark,
  BookmarkCheck,
  Wallet,
  Clock3,
  Megaphone,
  FileEdit,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { useAuth } from "../../context/AuthContext.jsx";
import { getChallengeById, getChallenges } from "../../services/challengeService.js";
import { getProfile } from "../../services/startupService.js";
import { fetchChallengeById, fetchChallenges } from "../../api/challengeApi.js";
import { fetchMyProfile } from "../../api/profileApi.js";
import { hasApplied } from "../../services/applicationService.js";
import { getDraft } from "../../services/drafts.js";
import { getBookmarks, toggleBookmark } from "../../services/bookmarks.js";
import { matchScore, checkEligibility, rankChallenges } from "../../services/matching.js";
import { deadlineBadge, formatDate } from "../../services/deadlines.js";
import { Loading, ErrorBanner } from "../../components/feedback.jsx";
import { canUseDemoFallback } from "../../services/demoMode.js";

function ChallengeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState(null);
  const [profile, setProfile] = useState(null);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState([]);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        let data = null;
        let prof = null;
        let all = null;

        try {
          const [apiData, apiProf, apiList] = await Promise.all([
            fetchChallengeById(id),
            user?.id ? fetchMyProfile().catch(() => null) : Promise.resolve(null),
            fetchChallenges().catch(() => null),
          ]);
          if (apiData) data = apiData;
          if (apiProf?.profile) prof = apiProf.profile;
          if (apiList?.challenges?.length) all = apiList.challenges;
        } catch (apiErr) {
          if (!canUseDemoFallback("challenge details", apiErr)) {
            throw new Error("Unable to load the challenge details from the backend.", { cause: apiErr });
          }
        }

        const [fallbackData, fallbackProf, marks, fallbackAll] = await Promise.all([
          data ? Promise.resolve(data) : (canUseDemoFallback("challenge details fallback", "backend challenge lookup failed") ? getChallengeById(id) : null),
          prof ? Promise.resolve(prof) : (user?.id && canUseDemoFallback("profile load fallback", "backend profile lookup failed") ? getProfile(user?.id) : null),
          getBookmarks(user?.id),
          all ? Promise.resolve(all) : (canUseDemoFallback("challenge list fallback", "backend challenge list lookup failed") ? getChallenges() : []),
        ]);
        if (!mounted) return;
        setChallenge(fallbackData);
        setProfile(fallbackProf);
        setSaved(marks);
        if (fallbackData) {
          const [applied, dr] = await Promise.all([
            user?.id ? hasApplied(user.id, fallbackData.id) : Promise.resolve(false),
            user?.id ? getDraft(user.id, fallbackData.id) : Promise.resolve(null),
          ]);
          if (!mounted) return;
          setAlreadyApplied(applied);
          setDraft(dr);
          const ranked = rankChallenges(fallbackProf || {}, fallbackAll).filter(
            (r) => r.challenge.id !== fallbackData.id
          );
          const sameCat = ranked.filter(
            (r) => r.challenge.category === fallbackData.category
          );
          setRelated([...sameCat, ...ranked].slice(0, 3).map((r) => r.challenge));
        }
      } catch (e) {
        if (mounted) setError(e.message || "Failed to load challenge.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, user?.id]);

  const match = useMemo(
    () => (challenge ? matchScore(profile || {}, challenge) : null),
    [profile, challenge]
  );
  const eligibility = useMemo(
    () => (challenge ? checkEligibility(profile || {}, challenge) : null),
    [profile, challenge]
  );
  const badge = challenge ? deadlineBadge(challenge) : null;
  const isSaved = challenge ? saved.includes(challenge.id) : false;

  const handleBookmark = async () => {
    if (!challenge) return;
    setSaved(await toggleBookmark(user?.id, challenge.id));
  };

  if (loading) {
    return (
      <div className="details-page" style={{ margin: -32 }}>
        <Loading label="Loading challenge..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="details-page" style={{ margin: -32 }}>
        <ErrorBanner message={error} onRetry={() => navigate("/challenges")} />
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="details-page" style={{ margin: -32 }}>
        <button className="back-button" onClick={() => navigate("/challenges")}>
          <ArrowLeft size={18} />
          Back to Challenges
        </button>
        <div className="not-found">
          <h2>Challenge not found</h2>
          <p>The challenge you&apos;re looking for doesn&apos;t exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="details-page" style={{ margin: -32 }}>
      <button className="back-button" onClick={() => navigate("/challenges")}>
        <ArrowLeft size={18} />
        Back to Challenges
      </button>

      {draft && !alreadyApplied && (
        <div className="draft-banner">
          <FileEdit size={18} />
          <span>
            You have a draft from{" "}
            {formatDistanceToNow(parseISO(draft.updatedAt), { addSuffix: true })}.
          </span>
          <button
            className="primary-button"
            onClick={() => navigate(`/apply/${challenge.id}`)}
          >
            Resume draft
          </button>
        </div>
      )}

      <div className="details-card">
        <div className="details-header">
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="category-badge">{challenge.category}</span>
              {match && (
                <span className="match-pill">
                  <Sparkles size={14} />
                  {match.score}% match for you
                </span>
              )}
            </div>
            <h1>{challenge.title}</h1>
            {(challenge.tags || []).length > 0 && (
              <div className="tag-row">
                {challenge.tags.map((t) => (
                  <span className="tag-chip" key={t}>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
            <div className="deadline-large">
              <Calendar size={20} />
              <div>
                <span>Application Deadline</span>
                <strong>
                  {challenge.deadline} · {badge.label}
                </strong>
              </div>
            </div>
            <button
              className={`save-btn ${isSaved ? "active" : ""}`}
              onClick={handleBookmark}
            >
              {isSaved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
              {isSaved ? "Saved" : "Save for later"}
            </button>
          </div>
        </div>

        <div className="fact-grid">
          <div className="fact-item">
            <Building2 size={20} />
            <div>
              <span>Department</span>
              <strong>{challenge.department}</strong>
            </div>
          </div>
          <div className="fact-item">
            <MapPin size={20} />
            <div>
              <span>Location</span>
              <strong>{challenge.location}</strong>
            </div>
          </div>
          <div className="fact-item">
            <Wallet size={20} />
            <div>
              <span>Budget</span>
              <strong>{challenge.budget || "See details"}</strong>
            </div>
          </div>
          <div className="fact-item">
            <Clock3 size={20} />
            <div>
              <span>Duration</span>
              <strong>{challenge.duration || "—"}</strong>
            </div>
          </div>
          <div className="fact-item">
            <Tag size={20} />
            <div>
              <span>Category</span>
              <strong>{challenge.category}</strong>
            </div>
          </div>
          <div className="fact-item">
            <Megaphone size={20} />
            <div>
              <span>Posted</span>
              <strong>
                {challenge.postedDate ? formatDate(challenge.postedDate) : "—"}
              </strong>
            </div>
          </div>
        </div>

        {match && (
          <div className="details-section insight-panel">
            <h2>
              <Sparkles size={19} />
              Why {match.score}% for {profile?.startupName || "you"}
            </h2>
            {match.reasons.length > 0 && (
              <ul className="reasons-list">
                {match.reasons.map((r) => (
                  <li key={r}>
                    <CheckCircle size={17} />
                    {r}
                  </li>
                ))}
              </ul>
            )}
            {match.missing.length > 0 && (
              <div className="missing-box">
                <strong>Boost your match:</strong>
                <ul>
                  {match.missing.map((m) => (
                    <li key={m}>
                      {m} — <Link to="/profile">update profile</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {eligibility && (
          <div className="details-section">
            <h2>Eligibility check</h2>
            <ul className="elig-list">
              {eligibility.checks.map((c) => (
                <li key={c.id} className={c.ok ? "ok" : c.warn ? "warn" : "bad"}>
                  {c.ok ? <CheckCircle size={17} /> : <AlertTriangle size={17} />}
                  {c.label}
                </li>
              ))}
            </ul>
            {!eligibility.eligible && (
              <p style={{ marginTop: 10 }}>
                Complete the flagged items in <Link to="/profile">your profile</Link>{" "}
                before applying.
              </p>
            )}
          </div>
        )}

        <div className="details-section">
          <h2>About the Challenge</h2>
          <p>{challenge.description}</p>
        </div>

        <div className="details-section">
          <h2>Requirements</h2>
          <ul className="requirements-list">
            {challenge.requirements.map((requirement, index) => (
              <li key={index}>
                <CheckCircle size={18} />
                {requirement}
              </li>
            ))}
          </ul>
          {challenge.eligibility?.note && (
            <p className="elig-note">{challenge.eligibility.note}</p>
          )}
        </div>

        <div className="apply-section">
          <div>
            <h3>Have a solution for this challenge?</h3>
            <p>Submit your startup solution before the application deadline.</p>
            {alreadyApplied && (
              <p style={{ color: "#166534", fontWeight: 600, marginTop: 8 }}>
                You already applied — track it in My Applications.
              </p>
            )}
          </div>
          <button
            className="apply-button"
            onClick={() =>
              alreadyApplied
                ? navigate("/applications")
                : navigate(`/apply/${challenge.id}`)
            }
          >
            {alreadyApplied ? "Track Application" : draft ? "Resume & Apply" : "Apply Now"}
          </button>
        </div>

        {related.length > 0 && (
          <div className="details-section">
            <h2>Related challenges</h2>
            <div className="related-grid">
              {related.map((r) => (
                <button
                  key={r.id}
                  className="related-card"
                  onClick={() => navigate(`/challenges/${r.id}`)}
                >
                  <span className="category-badge">{r.category}</span>
                  <strong>{r.title}</strong>
                  <span className="related-meta">
                    {r.department} · {r.deadline}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="sticky-apply">
        <div>
          <strong>{challenge.title}</strong>
          <span>
            {challenge.deadline} · {badge.label}
            {challenge.budget ? ` · ${challenge.budget}` : ""}
          </span>
        </div>
        <button
          className="apply-button"
          onClick={() =>
            alreadyApplied
              ? navigate("/applications")
              : navigate(`/apply/${challenge.id}`)
          }
        >
          {alreadyApplied ? "Track Application" : "Apply Now"}
        </button>
      </div>
    </div>
  );
}

export default ChallengeDetails;
