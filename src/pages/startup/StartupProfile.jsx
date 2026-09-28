import { useEffect, useMemo, useState } from "react";
import { User, Building2, Mail, Phone, MapPin, Globe, Save, Rocket, Eye } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  emptyProfile,
  getProfile,
  saveProfile,
  profileStrength,
  validateDPIIT,
} from "../../services/startupService.js";
import { fetchMyProfile, updateMyProfile as apiSaveProfile } from "../../api/profileApi.js";
import { Loading, ErrorBanner, Toast } from "../../components/feedback.jsx";
import { canUseDemoFallback } from "../../services/demoMode.js";

const STAGES = ["Idea", "MVP", "Early Revenue", "Growth"];

const FIELD_LABELS = {
  startupName: "Startup name",
  founderName: "Founder",
  email: "Email",
  phone: "Phone",
  website: "Website",
  location: "Location",
  industry: "Industry",
  description: "Description",
  stage: "Stage",
  foundedYear: "Founded year",
  teamSize: "Team size",
  technology: "Technology",
  techTags: "Tech tags",
};

function StartupProfile() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({ ...emptyProfile });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        let p = null;
        try {
          const res = await fetchMyProfile();
          if (res?.profile) {
            p = res.profile;
          }
        } catch (apiErr) {
          if (!canUseDemoFallback("profile load", apiErr)) {
            throw new Error("Unable to load the profile from the backend.", { cause: apiErr });
          }
          p = await getProfile(user?.id);
        }

        if (!mounted || !p) return;
        setFormData({
          ...emptyProfile,
          ...p,
          email: p.email || user?.email || "",
          startupName: p.startupName || user?.startupName || "",
        });
      } catch (e) {
        if (mounted) setError(e.message || "Failed to load profile.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user?.id, user?.email, user?.startupName]);

  const strength = useMemo(() => profileStrength(formData), [formData]);
  const missingTop = useMemo(
    () => strength.checklist.filter((c) => !c.done).slice(0, 4),
    [strength]
  );
  const tags = useMemo(
    () =>
      String(formData.techTags || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 6),
    [formData.techTags]
  );

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setSaved("");
  };

  const validate = () => {
    const errs = {};
    if (!formData.startupName.trim()) errs.startupName = "Startup name is required.";
    if (!formData.founderName.trim()) errs.founderName = "Founder name is required.";
    if (!formData.email.trim()) errs.email = "Email is required.";
    else if (!/^\S+@\S+\.\S+$/.test(formData.email)) errs.email = "Enter a valid email.";
    if (formData.website && !/^https?:\/\/.+\..+/.test(formData.website)) {
      errs.website = "Website should start with http:// or https://";
    }
    if (formData.deckLink && !/^https?:\/\/.+\..+/.test(formData.deckLink)) {
      errs.deckLink = "Deck link should start with http:// or https://";
    }
    if (!formData.industry) errs.industry = "Please select an industry.";
    const dpiit = validateDPIIT(formData.dpiit);
    if (!dpiit.ok) errs.dpiit = dpiit.error;
    if (formData.teamSize !== "") {
      const n = Number(formData.teamSize);
      if (!Number.isInteger(n) || n < 1 || n > 10000)
        errs.teamSize = "Enter a valid team size (1+).";
    }
    if (formData.foundedYear !== "") {
      const y = Number(formData.foundedYear);
      const now = new Date().getFullYear();
      if (!Number.isInteger(y) || y < 1990 || y > now)
        errs.foundedYear = `Enter a year between 1990 and ${now}.`;
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    setError("");
    setSaved("");
    try {
      let next = null;
      try {
        const res = await apiSaveProfile(formData);
        next = res?.profile || formData;
      } catch (apiErr) {
        if (!canUseDemoFallback("profile save", apiErr)) {
          throw new Error("Profile update could not be saved in the backend.", { cause: apiErr });
        }
        next = await saveProfile(user?.id, formData);
      }
      setFormData(next);
      setSaved("Profile saved! Match scores and eligibility across the app just got sharper.");
    } catch (err) {
      setError(err.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-page" style={{ padding: 0 }}>
        <Loading label="Loading profile..." />
      </div>
    );
  }

  const ferr = (name) =>
    fieldErrors[name] ? (
      <span style={{ color: "#dc2626", fontSize: 13 }}>{fieldErrors[name]}</span>
    ) : null;

  return (
    <div style={{ margin: "-32px", padding: 32 }} className="profile-page">
      <div className="profile-header">
        <div>
          <h1>Startup Profile</h1>
          <p>Everything here powers your match scores and eligibility checks.</p>
        </div>
      </div>

      <ErrorBanner message={error} />
      <Toast message={saved} />

      <div className="profile-side-grid">
        <div className="strength-card">
          <div className="strength-top">
            <strong>Profile strength</strong>
            <span>{strength.percent}%</span>
          </div>
          <div className="score-bar">
            <div className="score-fill" style={{ width: `${strength.percent}%` }} />
          </div>
          {missingTop.length > 0 ? (
            <p className="muted">
              Missing: {missingTop.map((m) => FIELD_LABELS[m.field] || m.field).join(" · ")}
            </p>
          ) : (
            <p className="muted">Complete — maximum match accuracy unlocked.</p>
          )}
        </div>
        <div className="govt-preview">
          <span className="next-action-kicker" style={{ color: "#6366f1" }}>
            <Eye size={13} /> How departments see you
          </span>
          <div className="govt-preview-head">
            <div className="avatar">
              {(formData.startupName || user?.startupName || "S").charAt(0).toUpperCase()}
            </div>
            <div>
              <strong>{formData.startupName || user?.startupName || "Your startup"}</strong>
              <span>
                {[formData.industry, formData.stage, formData.location]
                  .filter(Boolean)
                  .join(" · ") || "Add details to complete this card"}
              </span>
            </div>
          </div>
          {tags.length > 0 && (
            <div className="tag-row">
              {tags.map((t) => (
                <span className="tag-chip" key={t}>
                  {t}
                </span>
              ))}
            </div>
          )}
          {formData.description && <p className="govt-desc">{formData.description}</p>}
        </div>
      </div>

      <form className="profile-form" onSubmit={handleSubmit} noValidate>
        <div className="form-section">
          <h2>
            <Building2 size={22} />
            Startup Information
          </h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Startup Name</label>
              <input
                type="text"
                name="startupName"
                placeholder="Enter startup name"
                value={formData.startupName}
                onChange={handleChange}
                required
              />
              {ferr("startupName")}
            </div>
            <div className="form-group">
              <label>Founder Name</label>
              <input
                type="text"
                name="founderName"
                placeholder="Enter founder name"
                value={formData.founderName}
                onChange={handleChange}
                required
              />
              {ferr("founderName")}
            </div>
            <div className="form-group">
              <label>
                <Mail size={16} />
                Email
              </label>
              <input
                type="email"
                name="email"
                placeholder="startup@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
              {ferr("email")}
            </div>
            <div className="form-group">
              <label>
                <User size={16} />
                <Phone size={16} />
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                placeholder="Enter phone number"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>
                <Globe size={16} />
                Website
              </label>
              <input
                type="url"
                name="website"
                placeholder="https://example.com"
                value={formData.website}
                onChange={handleChange}
              />
              {ferr("website")}
            </div>
            <div className="form-group">
              <label>
                <MapPin size={16} />
                Location
              </label>
              <input
                type="text"
                name="location"
                placeholder="City, State"
                value={formData.location}
                onChange={handleChange}
              />
            </div>
            <div className="form-group full-width">
              <label>Industry</label>
              <select name="industry" value={formData.industry} onChange={handleChange} required>
                <option value="">Select industry</option>
                <option value="Technology">Technology</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Education">Education</option>
                <option value="Agriculture">Agriculture</option>
                <option value="FinTech">FinTech</option>
                <option value="CleanTech">CleanTech</option>
                <option value="Artificial Intelligence">Artificial Intelligence</option>
                <option value="Governance">Governance</option>
                <option value="Other">Other</option>
              </select>
              {ferr("industry")}
            </div>
            <div className="form-group full-width">
              <label>Startup Description</label>
              <textarea
                name="description"
                placeholder="Tell us about your startup, product, and solution... mention key technologies for better matches."
                rows="5"
                value={formData.description}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>
            <Rocket size={22} />
            Startup Details & Matching
          </h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Stage</label>
              <select name="stage" value={formData.stage} onChange={handleChange}>
                <option value="">Select stage</option>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Team Size</label>
              <input
                type="number"
                name="teamSize"
                min="1"
                placeholder="e.g. 5"
                value={formData.teamSize}
                onChange={handleChange}
              />
              {ferr("teamSize")}
            </div>
            <div className="form-group">
              <label>Founded Year</label>
              <input
                type="number"
                name="foundedYear"
                placeholder="e.g. 2023"
                value={formData.foundedYear}
                onChange={handleChange}
              />
              {ferr("foundedYear")}
            </div>
            <div className="form-group">
              <label>DPIIT Number (optional)</label>
              <input
                type="text"
                name="dpiit"
                placeholder="e.g. DIPP12345"
                value={formData.dpiit}
                onChange={handleChange}
              />
              {ferr("dpiit")}
            </div>
            <div className="form-group full-width">
              <label>Core Technology</label>
              <input
                type="text"
                name="technology"
                placeholder="e.g. React, IoT sensors, Hindi NLP..."
                value={formData.technology}
                onChange={handleChange}
              />
            </div>
            <div className="form-group full-width">
              <label>Tech Tags (comma separated)</label>
              <input
                type="text"
                name="techTags"
                placeholder="e.g. iot, hindi, offline, analytics"
                value={formData.techTags}
                onChange={handleChange}
              />
            </div>
            <div className="form-group full-width">
              <label>Pitch Deck Link (optional)</label>
              <input
                type="url"
                name="deckLink"
                placeholder="https://..."
                value={formData.deckLink}
                onChange={handleChange}
              />
              {ferr("deckLink")}
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="save-button" disabled={saving}>
            <Save size={18} />
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default StartupProfile;
