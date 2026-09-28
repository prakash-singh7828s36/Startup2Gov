import apiClient from './client.js';

export async function fetchMyProfile() {
  const response = await apiClient.get('/profile/me');
  return response.data;
}

export async function updateMyProfile(profileData) {
  const response = await apiClient.put('/profile/me', profileData);
  return response.data;
}
