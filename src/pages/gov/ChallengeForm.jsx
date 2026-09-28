import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "../../context/AuthContext.jsx";
import { challengeCategories } from "../../data/challenges.js";
import {
  createChallenge,
  getGovChallengeById,
  updateChallenge,
} from "../../services/govChallengeService.js";
import {
  createGovChallenge,
  updateGovChallenge,
  fetchChallengeById,
} from "../../api/challengeApi.js";
import { Loading, ErrorBanner } from "../../components/feedback.jsx";
import { canUseDemoFallback } from "../../services/demoMode.js";

const CATEGORIES = challengeCategories.filter((c) => c !== "All");

function dateInputValue(challenge) {
  if (!challenge?.deadlineDate) return "";
  try {
    return format(new Date(challenge.deadlineDate), "yyyy-MM-dd");
  } catch {
    return "";
  }
}

function ChallengeForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { user } = useAuth();

  const [form, setForm] = useState({
    title: "",
    department: "",
    category: "",
    location: "",
    budget: "",
    duration: "",
    deadlineInput: "",
    description: "",
    requirements: "",
    tags: "",
    eligibilityNote: "",
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isEdit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((f) => ({
        ...f,
        department: user?.department || user?.orgName || f.department,
      }));
      return;
    }
    (async () => {
      setLoading(true);
      try {
        let c = null;
        try {
          c = await fetchChallengeById(id);
        } catch (apiErr) {
          if (!canUseDemoFallback("gov challenge load", apiErr)) {
            throw new Error("Challenge details could not be loaded from the backend.", { cause: apiErr });
          }
          c = await getGovChallengeById(id);
        }
        if (!c) {
          if (canUseDemoFallback("gov challenge load fallback", "backend challenge lookup failed")) {
            c = await getGovChallengeById(id);
          }
          if (!c) throw new Error("Challenge not found");
        }
        setForm({
          title: c.title || "",
          department: c.department || "",
          category: c.category || "",
          location: c.location || "",
          budget: c.budget || "",
          duration: c.duration || "",
          deadlineInput: dateInputValue(c),
          description: c.description || "",
          requirements: (c.requirements || []).join("\n"),
          tags: (c.tags || []).join(", "),
          eligibilityNote: c.eligibility?.note || "",
        });
      } catch (e) {
        setError(e.message || "Failed to load challenge.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, user?.department, user?.orgName]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim() || !form.department.trim() || !form.category.trim() || !form.description.trim()) {
      setError("Title, department, category and description are required.");
      return;
    }
    if (!form.deadlineInput) {
      setError("Application deadline is required.");
      return;
    }
    setSaving(true);

    const payload = {
      title: form.title,
      department: form.department,
      category: form.category,
      location: form.location,
      budget: form.budget,
      duration: form.duration,
      deadlineInput: form.deadlineInput,
      deadlineDate: form.deadlineInput,
      description: form.description,
      requirements: form.requirements,
      tags: form.tags,
      eligibilityNote: form.eligibilityNote,
    };

    try {
      if (isEdit) {
        try {
          await updateGovChallenge(id, payload);
        } catch (apiErr) {
          if (!canUseDemoFallback("gov challenge update", apiErr)) {
            throw new Error("Challenge update could not be saved in the backend.", { cause: apiErr });
          }
          await updateChallenge(id, user?.id, payload);
        }
      } else {
        try {
          await createGovChallenge(payload);
        } catch (apiErr) {
          if (!canUseDemoFallback("gov challenge create", apiErr)) {
            throw new Error("Challenge could not be published to the backend.", { cause: apiErr });
          }
          await createChallenge({
            govUserId: user?.id,
            govDisplayName: user?.displayName,
            ...payload,
          });
        }
      }
      navigate("/gov/challenges");
    } catch (err) {
      setError(err.message || "Failed to save challenge.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ margin: -32 }} className="profile-page">
      <div className="profile-header">
        <button className="back-button" onClick={() => navigate("/gov/challenges")}>
          <ArrowLeft size={16} />
          My Challenges
        </button>
        <h1 style={{ marginTop: 12 }}>{isEdit ? "Edit Challenge" : "New Challenge"}</h1>
        <p>
          {isEdit
            ? "Update details — startups see changes immediately."
            : "Publish to the shared pool — startups see it in Browse instantly."}
        </p>
      </div>

      <ErrorBanner message={error} />
      {loading ? (
        <Loading label="Loading challenge..." />
      ) : (
        <form className="profile-form" onSubmit={handleSubmit} noValidate>
          <div className="form-section">
            <h2>Challenge details</h2>
            <div className="form-grid">
              <div className="form-group full-width">
                <label htmlFor="title">Title *</label>
                <input
                  id="title"
                  value={form.title}
                  onChange={set("title")}
                  placeholder="e.g. AI-based Water Leakage Detection"
                />
              </div>
              <div className="form-group">
                <label htmlFor="department">Department *</label>
                <input
                  id="department"
                  value={form.department}
                  onChange={set("department")}
                  placeholder="e.g. Water & Sanitation Dept"
                />
              </div>
              <div className="form-group">
                <label htmlFor="category">Category *</label>
                <select id="category" value={form.category} onChange={set("category")}>
                  <option value="">Select category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="location">Location</label>
                <input
                  id="location"
                  value={form.location}
                  onChange={set("location")}
                  placeholder="e.g. Madhya Pradesh / Pan-India"
                />
              </div>
              <div className="form-group">
                <label htmlFor="deadlineInput">Application deadline *</label>
                <input
                  id="deadlineInput"
                  type="date"
                  value={form.deadlineInput}
                  onChange={set("deadlineInput")}
                />
              </div>
              <div className="form-group">
                <label htmlFor="budget">Budget</label>
                <input
                  id="budget"
                  value={form.budget}
                  onChange={set("budget")}
                  placeholder="e.g. ₹20 L pilot grant"
                />
              </div>
              <div className="form-group">
                <label htmlFor="duration">Duration</label>
                <input
                  id="duration"
                  value={form.duration}
                  onChange={set("duration")}
                  placeholder="e.g. 6-month pilot"
                />
              </div>
              <div className="form-group full-width">
                <label htmlFor="description">Description *</label>
                <textarea
                  id="description"
                  rows={4}
                  value={form.description}
                  onChange={set("description")}
                  placeholder="What problem should startups solve?"
                />
              </div>
              <div className="form-group full-width">
                <label htmlFor="requirements">Requirements (one per line)</label>
                <textarea
                  id="requirements"
                  rows={4}
                  value={form.requirements}
                  onChange={set("requirements")}
                  placeholder={"Real-time monitoring capability\nScalable for urban areas"}
                />
              </div>
              <div className="form-group">
                <label htmlFor="tags">Tags (comma separated)</label>
                <input
                  id="tags"
                  value={form.tags}
                  onChange={set("tags")}
                  placeholder="IoT, Sensors, Dashboard"
                />
              </div>
              <div className="form-group">
                <label htmlFor="eligibilityNote">Eligibility note</label>
                <input
                  id="eligibilityNote"
                  value={form.eligibilityNote}
                  onChange={set("eligibilityNote")}
                  placeholder="e.g. Deployable pilot version required"
                />
              </div>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={() => navigate("/gov/challenges")}
              >
                Cancel
              </button>
              <button type="submit" className="save-button" disabled={saving}>
                <Save size={16} />
                {saving ? "Saving..." : isEdit ? "Save changes" : "Publish challenge"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

export default ChallengeForm;
