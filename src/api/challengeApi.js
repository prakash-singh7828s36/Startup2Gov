import apiClient from './client.js';

export async function fetchChallenges(params = {}) {
  const response = await apiClient.get('/challenges', { params });
  return response.data;
}

export async function fetchChallengeById(id) {
  const response = await apiClient.get(`/challenges/${id}`);
  return response.data?.challenge;
}

export async function fetchOwnedGovChallenges() {
  const response = await apiClient.get('/challenges/owned');
  return response.data?.challenges || [];
}

export async function createGovChallenge(challengeData) {
  const response = await apiClient.post('/challenges', challengeData);
  return response.data?.challenge;
}

export async function updateGovChallenge(id, patchData) {
  const response = await apiClient.put(`/challenges/${id}`, patchData);
  return response.data?.challenge;
}

export async function updateGovChallengeStatus(id, status) {
  const response = await apiClient.patch(`/challenges/${id}/status`, { status });
  return response.data?.challenge;
}

export async function deleteGovChallenge(id) {
  const response = await apiClient.delete(`/challenges/${id}`);
  return response.data;
}
