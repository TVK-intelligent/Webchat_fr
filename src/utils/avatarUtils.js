/**
 * Utility functions for handling avatar URLs
 */

const API_BASE_URL = "http://localhost:8081";

/**
 * Get full avatar URL with proper prefix
 * @param {string} avatarUrl - The avatar URL from backend (may be relative path)
 * @param {boolean} addTimestamp - Whether to add timestamp for cache busting
 * @returns {string} - Full avatar URL
 */
export const getFullAvatarUrl = (avatarUrl, addTimestamp = false) => {
  if (!avatarUrl) return "";

  let fullUrl = avatarUrl.startsWith("http")
    ? avatarUrl
    : `${API_BASE_URL}${avatarUrl}`;

  if (addTimestamp) {
    const separator = fullUrl.includes("?") ? "&" : "?";
    fullUrl += `${separator}t=${Date.now()}`;
  }

  return fullUrl;
};

/**
 * Get avatar URL with cache busting
 * @param {string} avatarUrl - The avatar URL from backend
 * @returns {string} - Full avatar URL with timestamp
 */
export const getAvatarUrlWithTimestamp = (avatarUrl) => {
  return getFullAvatarUrl(avatarUrl, true);
};
