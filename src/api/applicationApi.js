import apiClient from './client.js';

export async function fetchMyApplications() {
  const response = await apiClient.get('/applications/my');
  return response.data?.applications || [];
}

export async function fetchApplicationById(id) {
  const response = await apiClient.get(`/applications/${id}`);
  return response.data?.application;
}

export async function submitApplication(applicationData) {
  const response = await apiClient.post('/applications', applicationData);
  return response.data?.application;
}

export async function withdrawApplication(id) {
  const response = await apiClient.delete(`/applications/${id}`);
  return response.data;
}

export async function fetchDraft(challengeId) {
  const response = await apiClient.get(`/applications/drafts/${challengeId}`);
  return response.data?.draft;
}

export async function saveDraft(challengeId, draftData) {
  const response = await apiClient.post(`/applications/drafts/${challengeId}`, draftData);
  return response.data?.draft;
}

export async function clearDraft(challengeId) {
  const response = await apiClient.delete(`/applications/drafts/${challengeId}`);
  return response.data;
}

export async function fetchGovInbox(params = {}) {
  const response = await apiClient.get('/applications/gov/inbox', { params });
  return response.data;
}

export async function reviewApplication(id, { status, note }) {
  const response = await apiClient.patch(`/applications/${id}/review`, { status, note });
  return response.data?.application;
}

export async function uploadDocument(file) {
  if (!file) return null;
  const formData = new FormData();
  formData.append('document', file);

  const response = await apiClient.post('/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data?.document;
}
