/**
 * Challenge Matching Service
 * 
 * Transparent, explainable match score (0-100) + reasons.
 * Formula weights:
 * 1. Industry fit: 30 pts (Exact: 30, Related: 22, Cross-domain: 6)
 * 2. Keyword overlap: 30 pts (Proportional to matched tags/keywords up to 5)
 * 3. Profile strength: 20 pts (Calculated from completion of core/extended fields)
 * 4. Stage fit: 10 pts (Matches challenge eligibility stages: 10, Idea: 4)
 * 5. Team readiness: 10 pts (Meets challenge minTeam threshold: 10, Partial: 5)
 */

function profileText(profile) {
  return [
    profile?.industry,
    profile?.description,
    profile?.technology,
    profile?.techTags,
    profile?.startupName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function keywordHits(profile, challenge) {
  const text = profileText(profile);
  if (!text) return [];
  const keywords = challenge.matchKeywords?.length
    ? challenge.matchKeywords
    : challenge.tags || [];
  return keywords.filter((k) => k && text.includes(String(k).toLowerCase()));
}

export function calculateMatchScore(profile, challenge) {
  const reasons = [];
  const missing = [];
  let score = 0;

  // 1. Industry fit (30 pts)
  const industry = String(profile?.industry || '').toLowerCase();
  const category = String(challenge.category || '').toLowerCase();
  if (industry && category) {
    if (industry === category) {
      score += 30;
      reasons.push(`Industry matches (${challenge.category})`);
    } else if (
      (industry.includes('tech') && category.includes('artificial')) ||
      (industry.includes('artificial') && category.includes('tech'))
    ) {
      score += 22;
      reasons.push('Closely related field (Tech ↔ AI)');
    } else {
      score += 6;
      reasons.push('Cross-domain application possible');
    }
  } else {
    missing.push('Add your industry to improve matches');
  }

  // 2. Keyword overlap (30 pts)
  const hits = keywordHits(profile, challenge);
  const totalKw = (challenge.matchKeywords || challenge.tags || []).length || 1;
  const kwScore = Math.min(30, Math.round((hits.length / Math.min(totalKw, 5)) * 30));
  score += kwScore;
  if (hits.length > 0) {
    reasons.push(`Profile mentions: ${hits.slice(0, 3).join(', ')}`);
  } else {
    missing.push('Add tech tags or solution keywords');
  }

  // 3. Profile strength (20 pts)
  const fields = [
    'startupName',
    'founderName',
    'email',
    'phone',
    'website',
    'location',
    'industry',
    'description',
  ];
  const filled = fields.filter((f) => String(profile?.[f] || '').trim() !== '');
  const completionPercent = (filled.length / fields.length) * 100;
  const strengthScore = Math.round((completionPercent / 100) * 20);
  score += strengthScore;
  if (completionPercent >= 80) {
    reasons.push('Profile is comprehensive');
  } else {
    missing.push('Complete basic profile info (+20%)');
  }

  // 4. Stage fit (10 pts)
  const stage = profile?.stage;
  const stages = challenge.eligibility?.stages || ['MVP', 'Early Revenue', 'Growth'];
  if (stage && stages.includes(stage)) {
    score += 10;
    reasons.push(`Stage fits (${stage})`);
  } else if (!stage) {
    missing.push('Select your startup stage');
  } else {
    score += 4;
    reasons.push(`Early stage (${stage}) — check eligibility notes`);
  }

  // 5. Team readiness (10 pts)
  const minTeam = challenge.eligibility?.minTeam ?? 1;
  const team = profile?.teamSize ? Number(profile.teamSize) : 0;
  if (team >= minTeam) {
    score += 10;
    reasons.push(`Team size (${team}) meets requirement (${minTeam}+)`);
  } else if (team > 0) {
    score += 5;
    reasons.push(`Team size (${team}) below desired (${minTeam}+)`);
  } else {
    missing.push('Add team size to verify eligibility');
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    reasons,
    missing,
  };
}
