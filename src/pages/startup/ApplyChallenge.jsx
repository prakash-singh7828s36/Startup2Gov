import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Send,
  Upload,
  FileText,
  CheckCircle,
  CalendarPlus,
  CloudUpload,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "../../context/AuthContext.jsx";
import { getChallengeById } from "../../services/challengeService.js";
import { getProfile } from "../../services/startupService.js";
import { submitApplication } from "../../services/applicationService.js";
import { validateFile, mockUploadDocument } from "../../services/storageService.js";
import { getDraft, saveDraft } from "../../services/drafts.js";
import { canUseDemoFallback } from "../../services/demoMode.js";
import { fetchChallengeById } from "../../api/challengeApi.js";
import { fetchMyProfile } from "../../api/profileApi.js";
import {
  fetchDraft as apiFetchDraft,
  saveDraft as apiSaveDraft,
  submitApplication as apiSubmitApplication,
  uploadDocument as apiUploadDocument,
} from "../../api/applicationApi.js";
import { deadlineICS } from "../../services/deadlines.js";
import { Loading, ErrorBanner, Toast } from "../../components/feedback.jsx";

const STEPS = ["Startup", "Solution", "Review & Submit"];

const EMPTY_FORM = {
  startupName: "",
  contactPerson: "",
  solutionTitle: "",
  solutionDescription: "",
  challengeSolution: "",
  expectedImpact: "",
  technology: "",
};

function ApplyChallenge() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [challenge, setChallenge] = useState(null);
  const [loadingChallenge, setLoadingChallenge] = useState(true);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [document, setDocument] = useState(null);
  const [draftName, setDraftName] = useState("");
  const [draftAt, setDraftAt] = useState(null);
  const [resumed, setResumed] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [stepErrors, setStepErrors] = useState({});
  const saveTimer = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        let c = null;
        let profile = null;
        let draft = null;

        const [apiC, apiProf, apiDraft] = await Promise.all([
          fetchChallengeById(id),
          user?.id ? fetchMyProfile().catch(() => null) : Promise.resolve(null),
          user?.id ? apiFetchDraft(id).catch(() => null) : Promise.resolve(null),
        ]);

        if (!apiC) {
          if (canUseDemoFallback("challenge load", "backend challenge lookup failed")) {
            c = await getChallengeById(id);
          } else {
            throw new Error("Challenge could not be loaded from the backend.", { cause: apiC });
          }
        } else {
          c = apiC;
        }

        if (apiProf?.profile) {
          profile = apiProf.profile;
        } else if (user?.id && !canUseDemoFallback("profile load", "backend profile lookup failed")) {
          profile = null;
        } else if (user?.id && !profile) {
          profile = await getProfile(user.id);
        }

        if (apiDraft) {
          draft = apiDraft;
        } else if (user?.id) {
          const canLoadLocalDraft = canUseDemoFallback("draft load", "backend draft lookup failed");
          if (canLoadLocalDraft) {
            const localDraft = await getDraft(user.id, id).catch(() => null);
            draft = localDraft;
          }
        }

        if (!mounted) return;

        setChallenge(c);
        const base = {
          ...EMPTY_FORM,
          startupName: profile?.startupName || user?.startupName || "",
          contactPerson: profile?.founderName || "",
          technology: profile?.technology || profile?.techTags || "",
        };
        if (draft?.data?.formData) {
          const saved = draft.data.formData;
          setFormData({ ...base, ...saved });
          if (draft.data.documentName) setDraftName(draft.data.documentName);
          setDraftAt(draft.updatedAt);
          setResumed(true);
          const hasSolution = ["solutionTitle", "solutionDescription", "challengeSolution"].some(
            (f) => String(saved[f] || "").trim() !== ""
          );
          if (hasSolution) setStep(2);
        } else {
          setFormData(base);
        }
      } catch {
        if (mounted) setError("Failed to load challenge.");
      } finally {
        if (mounted) {
          setLoadingChallenge(false);
          setReady(true);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, user?.id, user?.startupName]);

  // Autosave draft (debounced). File objects can't persist — store the name only.
  useEffect(() => {
    if (!ready || submitted || !user?.id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        let saved = null;
        try {
          saved = await apiSaveDraft(id, {
            formData,
            documentName: document ? document.name : draftName,
          });
        } catch (saveErr) {
          if (canUseDemoFallback("draft save", saveErr)) {
            saved = await saveDraft(user.id, id, {
              formData,
              documentName: document ? document.name : draftName,
            });
          } else {
            setError("Draft could not be saved. Please retry when the backend is available.");
            return;
          }
        }
        if (saved?.updatedAt) {
          setDraftAt(saved.updatedAt);
        }
      } catch {
        // Draft saving is best-effort; submission is the source of truth.
      }
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, document, ready, id, user?.id]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setStepErrors({});
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0] || null;
    if (!file) {
      setDocument(null);
      return;
    }
    const check = validateFile(file);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError("");
    setDocument(file);
    setDraftName("");
  };

  const validateStep = (s) => {
    const errs = {};
    if (s === 1) {
      if (!formData.startupName.trim()) errs.startupName = "Startup name is required.";
      if (!formData.contactPerson.trim()) errs.contactPerson = "Contact person is required.";
    }
    if (s === 2) {
      if (!formData.solutionTitle.trim()) errs.solutionTitle = "Solution title is required.";
      if (!formData.solutionDescription.trim())
        errs.solutionDescription = "Describe your solution.";
      if (!formData.challengeSolution.trim())
        errs.challengeSolution = "Explain how it solves the challenge.";
      if (!formData.expectedImpact.trim()) errs.expectedImpact = "Expected impact is required.";
      if (!formData.technology.trim()) errs.technology = "Technology used is required.";
    }
    return errs;
  };

  const next = () => {
    const errs = validateStep(step);
    setStepErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setStep((s) => Math.min(3, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const back = () => {
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = { ...validateStep(1), ...validateStep(2) };
    if (Object.keys(errs).length > 0) {
      setStepErrors(errs);
      setStep(errs.startupName || errs.contactPerson ? 1 : 2);
      return;
    }
    setError("");
    if (!challenge) {
      setError("Challenge not found.");
      return;
    }
    setSubmitting(true);
    try {
      let uploaded = null;
      if (document) {
        try {
          uploaded = await apiUploadDocument(document);
        } catch (uploadErr) {
          if (canUseDemoFallback("document upload", uploadErr)) {
            uploaded = await mockUploadDocument(user?.id, document);
          } else {
            throw new Error("Document upload failed. Please try again.", { cause: uploadErr });
          }
        }
      }

      let record = null;
      try {
        record = await apiSubmitApplication({
          challengeId: id,
          challenge,
          ...formData,
          document: uploaded,
        });
      } catch (apiErr) {
        // If API explicitly rejects due to duplicates or validation, show error
        if (apiErr.response?.data?.message) {
          throw new Error(apiErr.response.data.message, { cause: apiErr });
        }
        if (canUseDemoFallback("application submission", apiErr)) {
          record = await submitApplication({
            userId: user?.id,
            challenge,
            ...formData,
            document: uploaded,
          });
        } else {
          throw new Error("The backend rejected this application. Please review the form and try again.", { cause: apiErr });
        }
      }

      setDraftAt(null);
      setSubmitted(record);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err.message || "Failed to submit application.");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadICS = () => {
    const ics = deadlineICS(challenge);
    if (!ics) return;
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `challenge-${challenge.id}-deadline.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (submitted) {
    return (
      <div className="application-success" style={{ margin: -32 }}>
        <div className="success-card">
          <div className="success-icon">
            <CheckCircle size={60} />
          </div>
          <h1>Application Submitted!</h1>
          <p>
            Application <strong>{submitted.id}</strong> for{" "}
            <strong>{submitted.challenge}</strong> is now <strong>Pending</strong>.
            Track every update from My Applications.
          </p>
          <ul className="success-timeline">
            <li className="done">
              <CheckCircle size={16} /> Submitted — today
            </li>
            <li>
              <span className="tl-dot" /> Under review — department evaluates fit
            </li>
            <li>
              <span className="tl-dot" /> Decision — Approved / feedback shared
            </li>
          </ul>
          <div className="success-actions">
            <button onClick={() => navigate("/applications")} className="primary-button">
              View My Applications
            </button>
            <button onClick={downloadICS} className="secondary-button">
              <CalendarPlus size={17} />
              Add deadline to calendar
            </button>
            <button onClick={() => navigate("/challenges")} className="secondary-button">
              Browse More Challenges
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loadingChallenge) {
    return (
      <div className="apply-page" style={{ margin: -32 }}>
        <Loading label="Loading application form..." />
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="apply-page" style={{ margin: -32 }}>
        <ErrorBanner message="Challenge not found." />
        <button className="secondary-button" onClick={() => navigate("/challenges")}>
          Back to Challenges
        </button>
      </div>
    );
  }

  const fieldErr = (name) =>
    stepErrors[name] ? (
      <span style={{ color: "#dc2626", fontSize: 13 }}>{stepErrors[name]}</span>
    ) : null;

  return (
    <div className="apply-page" style={{ margin: -32 }}>
      <button className="back-button" onClick={() => navigate(`/challenges/${id}`)}>
        <ArrowLeft size={18} />
        Back to Challenge
      </button>
      <div className="apply-header">
        <h1>Apply to Challenge</h1>
        <p>
          <strong>{challenge.title}</strong> ({challenge.department}) · Deadline{" "}
          {challenge.deadline}
          {challenge.budget ? ` · ${challenge.budget}` : ""}
        </p>
      </div>

      <div className="wizard-steps">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`wizard-step ${step === i + 1 ? "active" : ""} ${step > i + 1 ? "done" : ""}`}
          >
            <span className="wizard-num">{step > i + 1 ? <CheckCircle size={18} /> : i + 1}</span>
            {label}
          </div>
        ))}
        <span className="draft-hint">
          <CloudUpload size={15} />
          {draftAt
            ? `Draft saved ${formatDistanceToNow(new Date(draftAt), { addSuffix: true })}`
            : "Draft autosaves as you type"}
        </span>
      </div>

      <ErrorBanner message={error} />
      {resumed && (
        <Toast message="Resumed your saved draft — pick up where you left off." />
      )}

      <form className="application-form" onSubmit={handleSubmit}>
        {step === 1 && (
          <div className="application-section">
            <h2>Startup Information</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Startup Name</label>
                <input
                  type="text"
                  name="startupName"
                  placeholder="Enter startup name"
                  value={formData.startupName}
                  onChange={handleChange}
                />
                {fieldErr("startupName")}
              </div>
              <div className="form-group">
                <label>Contact Person</label>
                <input
                  type="text"
                  name="contactPerson"
                  placeholder="Enter contact person's name"
                  value={formData.contactPerson}
                  onChange={handleChange}
                />
                {fieldErr("contactPerson")}
              </div>
            </div>
            <p className="step-hint">
              Pulled from your profile — keep it in sync in{" "}
              <span className="link" onClick={() => navigate("/profile")}>
                Startup Profile
              </span>
              .
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="application-section">
            <h2>Solution Details</h2>
            <div className="form-grid">
              <div className="form-group full-width">
                <label>Solution Title</label>
                <input
                  type="text"
                  name="solutionTitle"
                  placeholder="Enter the name of your solution"
                  value={formData.solutionTitle}
                  onChange={handleChange}
                />
                {fieldErr("solutionTitle")}
              </div>
              <div className="form-group full-width">
                <label>Solution Description</label>
                <textarea
                  name="solutionDescription"
                  placeholder="Describe your solution..."
                  rows="5"
                  value={formData.solutionDescription}
                  onChange={handleChange}
                />
                {fieldErr("solutionDescription")}
              </div>
              <div className="form-group full-width">
                <label>How does your solution solve the challenge?</label>
                <textarea
                  name="challengeSolution"
                  placeholder="Explain how your solution addresses the government's challenge..."
                  rows="5"
                  value={formData.challengeSolution}
                  onChange={handleChange}
                />
                {fieldErr("challengeSolution")}
              </div>
              <div className="form-group full-width">
                <label>Expected Impact</label>
                <textarea
                  name="expectedImpact"
                  placeholder="Describe the expected social, economic, or environmental impact..."
                  rows="4"
                  value={formData.expectedImpact}
                  onChange={handleChange}
                />
                {fieldErr("expectedImpact")}
              </div>
              <div className="form-group full-width">
                <label>Technology Used</label>
                <input
                  type="text"
                  name="technology"
                  placeholder="e.g. React, Node.js, AI, IoT..."
                  value={formData.technology}
                  onChange={handleChange}
                />
                {fieldErr("technology")}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <>
            <div className="application-section">
              <h2>Supporting Document</h2>
              <div className="upload-box">
                <Upload size={32} />
                <h3>Upload your solution document</h3>
                <p>
                  PDF, DOC or DOCX up to 5MB. Optional — but applications with
                  documents get reviewed faster.
                </p>
                <label className="upload-button">
                  <FileText size={18} />
                  Choose File
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} hidden />
                </label>
                {(document || draftName) && (
                  <div className="selected-file">
                    <FileText size={18} />
                    {document
                      ? `${document.name} (${Math.round(document.size / 1024)} KB)`
                      : `${draftName} (re-select to replace)`}
                  </div>
                )}
              </div>
            </div>

            <div className="application-section review-section">
              <h2>Review your application</h2>
              <dl className="review-list">
                <div>
                  <dt>Challenge</dt>
                  <dd>{challenge.title}</dd>
                </div>
                <div>
                  <dt>Startup</dt>
                  <dd>
                    {formData.startupName} · {formData.contactPerson}
                    <button type="button" className="link" onClick={() => setStep(1)}>
                      Edit
                    </button>
                  </dd>
                </div>
                <div>
                  <dt>Solution</dt>
                  <dd>
                    {formData.solutionTitle}
                    <button type="button" className="link" onClick={() => setStep(2)}>
                      Edit
                    </button>
                  </dd>
                </div>
                <div>
                  <dt>Technology</dt>
                  <dd>{formData.technology}</dd>
                </div>
                <div>
                  <dt>Document</dt>
                  <dd>{document ? document.name : draftName || "None attached"}</dd>
                </div>
              </dl>
            </div>
          </>
        )}

        <div className="application-actions wizard-actions">
          {step > 1 ? (
            <button type="button" className="cancel-button" onClick={back} disabled={submitting}>
              <ArrowLeft size={17} />
              Back
            </button>
          ) : (
            <button
              type="button"
              className="cancel-button"
              onClick={() => navigate(`/challenges/${id}`)}
              disabled={submitting}
            >
              Cancel
            </button>
          )}
          {step < 3 ? (
            <button type="button" className="submit-button" onClick={next}>
              Continue
              <ArrowRight size={18} />
            </button>
          ) : (
            <button type="submit" className="submit-button" disabled={submitting}>
              <Send size={18} />
              {submitting ? "Submitting..." : "Submit Application"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default ApplyChallenge;
