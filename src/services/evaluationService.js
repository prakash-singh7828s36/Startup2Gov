// Member 4 - Evaluation & Matching Engine
// Transparent rule-based scoring for Government evaluators.
//
// Official weights:
// Technology Match  - 30
// Domain Match      - 25
// Eligibility       - 20
// Experience        - 15
// Budget            - 10
// Total             - 100

const WEIGHTS = {
  technology: 30,
  domain: 25,
  eligibility: 20,
  experience: 15,
  budget: 10,
};

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

function toArray(value) {
  if (Array.isArray(value)) return value;

  if (!value) return [];

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values.map(normalize).filter(Boolean))];
}

function textWords(value) {
  return normalize(value)
    .split(/[\s,./|;:()[\]{}+\-_]+/)
    .filter((word) => word.length >= 3);
}

// ---------------------------------------------------------
// TECHNOLOGY MATCH - 30
// ---------------------------------------------------------

export function technologyMatch(startup, challenge) {
  const startupTech = unique([
    ...toArray(startup?.technology),
    ...toArray(startup?.techTags),
    ...toArray(startup?.tags),
  ]);

  const challengeTech = unique([
    ...toArray(challenge?.tags),
    ...toArray(challenge?.matchKeywords),
    ...toArray(challenge?.requirements),
  ]);

  if (startupTech.length === 0 || challengeTech.length === 0) {
    return {
      score: 0,
      max: WEIGHTS.technology,
      matched: [],
      reason: "Technology information is incomplete.",
    };
  }

  const startupText = startupTech.join(" ");
  const challengeText = challengeTech.join(" ");

  const matched = startupTech.filter((tech) =>
    challengeText.includes(tech)
  );

  // Also check individual words.
  const startupWords = textWords(startupText);
  const challengeWords = textWords(challengeText);

  const wordMatches = startupWords.filter((word) =>
    challengeWords.includes(word)
  );

  const totalMatches = unique([...matched, ...wordMatches]);

  const ratio = Math.min(
    1,
    totalMatches.length / Math.max(3, Math.min(challengeTech.length, 6))
  );

  const score = Math.round(ratio * WEIGHTS.technology);

  return {
    score,
    max: WEIGHTS.technology,
    matched: totalMatches.slice(0, 6),
    reason:
      totalMatches.length > 0
        ? `Technology overlap: ${totalMatches.slice(0, 4).join(", ")}`
        : "No strong technology overlap found.",
  };
}

// ---------------------------------------------------------
// DOMAIN MATCH - 25
// ---------------------------------------------------------

export function domainMatch(startup, challenge) {
  const industry = normalize(startup?.industry);
  const category = normalize(challenge?.category);

  if (!industry || !category) {
    return {
      score: 0,
      max: WEIGHTS.domain,
      reason: "Industry or challenge domain is missing.",
    };
  }

  if (industry === category) {
    return {
      score: WEIGHTS.domain,
      max: WEIGHTS.domain,
      reason: `Exact domain match: ${challenge.category}`,
    };
  }

  // Transparent related-domain rules for prototype.
  const related = [
    ["technology", "artificial intelligence"],
    ["artificial intelligence", "technology"],
    ["technology", "governance"],
    ["governance", "technology"],
    ["cleantech", "technology"],
    ["technology", "cleantech"],
    ["fintech", "technology"],
    ["technology", "fintech"],
  ];

  const isRelated = related.some(
    ([a, b]) => industry === a && category === b
  );

  if (isRelated) {
    return {
      score: 18,
      max: WEIGHTS.domain,
      reason: `Related domain: ${startup.industry} → ${challenge.category}`,
    };
  }

  return {
    score: 8,
    max: WEIGHTS.domain,
    reason: "Cross-domain solution; evaluator review recommended.",
  };
}

// ---------------------------------------------------------
// ELIGIBILITY - 20
// ---------------------------------------------------------

export function eligibilityCheck(startup, challenge) {
  const checks = [];

  // Stage
  const stage = String(startup?.stage || "").trim();
  const allowedStages = challenge?.eligibility?.stages || [];

  if (!stage) {
    checks.push({
      id: "stage",
      label: "Startup stage not provided",
      status: "warning",
    });
  } else if (
    allowedStages.length === 0 ||
    allowedStages.includes(stage)
  ) {
    checks.push({
      id: "stage",
      label: `Stage requirement satisfied (${stage})`,
      status: "pass",
    });
  } else {
    checks.push({
      id: "stage",
      label: `Stage ${stage} is outside preferred stages`,
      status: "warning",
    });
  }

  // Team size
  const teamSize = Number(startup?.teamSize || 0);
  const minTeam = Number(challenge?.eligibility?.minTeam || 0);

  if (!teamSize) {
    checks.push({
      id: "team",
      label: "Team size not provided",
      status: "warning",
    });
  } else if (!minTeam || teamSize >= minTeam) {
    checks.push({
      id: "team",
      label: `Team requirement satisfied (${teamSize} members)`,
      status: "pass",
    });
  } else {
    checks.push({
      id: "team",
      label: `Minimum ${minTeam} members required; startup has ${teamSize}`,
      status: "warning",
    });
  }

  // DPIIT
  const needsDPIIT = Boolean(challenge?.eligibility?.needsDPIIT);
  const hasDPIIT = Boolean(String(startup?.dpiit || "").trim());

  if (!needsDPIIT) {
    checks.push({
      id: "dpiit",
      label: "DPIIT registration not required",
      status: "pass",
    });
  } else if (hasDPIIT) {
    checks.push({
      id: "dpiit",
      label: "DPIIT registration provided",
      status: "pass",
    });
  } else {
    checks.push({
      id: "dpiit",
      label: "DPIIT registration required",
      status: "warning",
    });
  }

  const passed = checks.filter((c) => c.status === "pass").length;

  const score = Math.round(
    (passed / Math.max(checks.length, 1)) * WEIGHTS.eligibility
  );

  return {
    score,
    max: WEIGHTS.eligibility,
    checks,
    eligible: checks.every((c) => c.status !== "warning"),
    reason:
      passed === checks.length
        ? "All available eligibility checks passed."
        : `${passed}/${checks.length} eligibility checks passed.`,
  };
}

// ---------------------------------------------------------
// EXPERIENCE - 15
// ---------------------------------------------------------

export function experienceMatch(startup) {
  const foundedYear = Number(startup?.foundedYear || 0);

  if (!foundedYear) {
    return {
      score: 5,
      max: WEIGHTS.experience,
      years: null,
      reason: "Founded year not provided; experience needs verification.",
    };
  }

  const currentYear = new Date().getFullYear();
  const years = Math.max(0, currentYear - foundedYear);

  let score;

  if (years >= 5) {
    score = 15;
  } else if (years >= 3) {
    score = 12;
  } else if (years >= 1) {
    score = 9;
  } else {
    score = 6;
  }

  return {
    score,
    max: WEIGHTS.experience,
    years,
    reason: `${years} year${years === 1 ? "" : "s"} of operating experience`,
  };
}

// ---------------------------------------------------------
// BUDGET - 10
// ---------------------------------------------------------

function extractBudget(value) {
  const text = String(value || "");

  const match = text.match(/₹\s*([\d.]+)\s*L/i);

  if (!match) return null;

  return Number(match[1]);
}

export function budgetCompatibility(startup, challenge) {
  const challengeBudget = extractBudget(challenge?.budget);

  // The current Member 3 profile does not yet contain a requested
  // pilot-budget field. Therefore unknown startup budget receives
  // a neutral score rather than being treated as a failure.
  const startupBudget = extractBudget(
    startup?.pilotBudget || startup?.budget
  );

  if (!challengeBudget) {
    return {
      score: 5,
      max: WEIGHTS.budget,
      reason: "Challenge budget could not be determined.",
    };
  }

  if (!startupBudget) {
    return {
      score: 5,
      max: WEIGHTS.budget,
      challengeBudget,
      reason: `Challenge pilot budget: ₹${challengeBudget}L; startup budget not provided.`,
    };
  }

  if (startupBudget <= challengeBudget) {
    return {
      score: 10,
      max: WEIGHTS.budget,
      challengeBudget,
      startupBudget,
      reason: `Requested ₹${startupBudget}L fits within ₹${challengeBudget}L pilot budget.`,
    };
  }

  const difference = startupBudget - challengeBudget;

  if (difference <= challengeBudget * 0.25) {
    return {
      score: 6,
      max: WEIGHTS.budget,
      challengeBudget,
      startupBudget,
      reason: `Requested budget is slightly above the ₹${challengeBudget}L pilot budget.`,
    };
  }

  return {
    score: 2,
    max: WEIGHTS.budget,
    challengeBudget,
    startupBudget,
    reason: `Requested ₹${startupBudget}L exceeds the ₹${challengeBudget}L pilot budget.`,
  };
}

// ---------------------------------------------------------
// COMPLETE EVALUATION
// ---------------------------------------------------------

export function evaluateStartup(startup, challenge) {
  const technology = technologyMatch(startup, challenge);
  const domain = domainMatch(startup, challenge);
  const eligibility = eligibilityCheck(startup, challenge);
  const experience = experienceMatch(startup, challenge);
  const budget = budgetCompatibility(startup, challenge);

  const total =
    technology.score +
    domain.score +
    eligibility.score +
    experience.score +
    budget.score;

  const reasons = [
    technology.reason,
    domain.reason,
    eligibility.reason,
    experience.reason,
    budget.reason,
  ];

  return {
    startup,
    challenge,
    score: Math.max(0, Math.min(100, total)),
    breakdown: {
      technology,
      domain,
      eligibility,
      experience,
      budget,
    },
    reasons,
    eligible: eligibility.eligible,
  };
}

// ---------------------------------------------------------
// RANK STARTUPS
// ---------------------------------------------------------

export function rankStartups(startups, challenge) {
  return startups
    .map((startup) => evaluateStartup(startup, challenge))
    .sort((a, b) => b.score - a.score)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
}

// ---------------------------------------------------------
// APPLICATION → STARTUP PROFILE ADAPTER
// ---------------------------------------------------------

export function applicationToStartup(application, profile = {}) {
  return {
    ...profile,

    id: profile?.id || application?.userId || application?.id,

    startupName:
      profile?.startupName ||
      application?.startupName ||
      application?.solution ||
      "Unnamed Startup",

    founderName:
      profile?.founderName ||
      application?.contactPerson ||
      "Not provided",

    industry: profile?.industry || "",

    description:
      profile?.description ||
      application?.solutionDescription ||
      application?.challengeSolution ||
      "",

    technology:
      profile?.technology ||
      application?.technology ||
      "",

    techTags: profile?.techTags || "",

    stage: profile?.stage || "",

    teamSize: profile?.teamSize || "",

    foundedYear: profile?.foundedYear || "",

    dpiit: profile?.dpiit || "",

    pilotBudget:
      profile?.pilotBudget ||
      application?.pilotBudget ||
      "",

    applicationId: application?.id,

    applicationStatus: application?.status,

    solutionTitle: application?.solution,

    solutionDescription:
      application?.solutionDescription ||
      application?.challengeSolution ||
      "",
  };
}

// ---------------------------------------------------------
// Recommendation helper
// ---------------------------------------------------------

export function recommendationFor(score, eligible) {
  if (!eligible) {
    return "Review eligibility requirements";
  }

  if (score >= 85) {
    return "Strong candidate for pilot consideration";
  }

  if (score >= 70) {
    return "Consider for detailed evaluation";
  }

  if (score >= 50) {
    return "Needs further evaluation";
  }

  return "Low alignment — review before proceeding";
}

export { WEIGHTS };