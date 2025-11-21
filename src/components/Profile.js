import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { userService } from "../services/api";
import { getFullAvatarUrl } from "../utils/avatarUtils";
import "../styles/Profile.css";

const Profile = () => {
  const { user, logout, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      // Set avatar preview with full URL and cache-busting parameter
      if (user.avatarUrl) {
        const fullAvatarUrl = getFullAvatarUrl(user.avatarUrl);
        setAvatarPreview(`${fullAvatarUrl}?t=${Date.now()}`);
      } else {
        setAvatarPreview("");
      }
    }
  }, [user]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("File size cannot exceed 5MB");
        return;
      }

      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }

      setAvatarFile(file);
      setError("");

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      console.log("Starting profile update process...");

      // Create FormData for the request
      const formData = new FormData();

      // Add displayName if it has changed
      if (displayName.trim() !== (user.displayName || "").trim()) {
        formData.append("displayName", displayName.trim());
        console.log("Adding displayName to form:", displayName.trim());
      }

      // Add avatar file if selected
      if (avatarFile) {
        formData.append("avatar", avatarFile);
        console.log("Adding avatar file:", avatarFile.name);
      }

      // Check if there's anything to update
      if (!formData.has("displayName") && !formData.has("avatar")) {
        setMessage(" Không có thay đổi nào để lưu");
        return;
      }

      console.log("Sending update request...");
      const response = await userService.updateUserProfile(user.id, formData);

      console.log("Profile updated successfully:", response.data);

      // Clear the avatar file after successful upload
      setAvatarFile(null);

      // Update the preview URL
      if (response.data.avatarUrl) {
        const fullAvatarUrl = getFullAvatarUrl(response.data.avatarUrl);
        setAvatarPreview(`${fullAvatarUrl}?t=${Date.now()}`);
      }

      setMessage("Profile updated successfully!");

      // Update auth context
      if (typeof updateUser === "function") {
        // Add a timestamp to force re-render of components
        const updatedData = {
          ...response.data,
          updatedAt: Date.now(),
        };
        updateUser(updatedData);
        console.log("Auth context updated with data:", updatedData);
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.message || err.message || "Profile update failed";
      setError(errorMsg);
      console.error("Error updating profile:", err);
      console.error("Error response:", err.response?.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h2>👤 Personal Profile</h2>
        <p className="header-subtitle">Update your personal information</p>
      </div>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleUpdateProfile} className="profile-form">
        <div className="profile-content">
          {/* Left Column - Avatar Upload */}
          <div className="profile-left">
            <div className="profile-section">
              <h3>Ảnh Đại Diện</h3>
              <div className="avatar-preview-container">
                <div className="avatar-preview">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      key={avatarPreview} // Force re-render when src changes
                    />
                  ) : (
                    <div className="avatar-placeholder">
                      {user?.displayName?.charAt(0).toUpperCase() ||
                        user?.username?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="avatar-controls">
                  <input
                    type="file"
                    id="avatar-input"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="avatar-input"
                  />
                  <label htmlFor="avatar-input" className="upload-btn-sm">
                    Choose Image
                  </label>
                  <p className="upload-hint-sm">
                    Tối đa 5MB
                    <br />
                    JPG, PNG, GIF
                  </p>
                  {avatarFile && <p className="file-name">{avatarFile.name}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Display Name & Actions */}
          <div className="profile-right">
            <div className="profile-section">
              <h3>Tên Hiển Thị</h3>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nhập tên hiển thị"
                maxLength="100"
                className="profile-input"
              />
              <p className="input-hint">
                Để trống để dùng tên: @{user?.username}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="profile-actions">
              <button type="submit" disabled={loading} className="btn-save">
                {loading ? "Saving..." : "💾 Save Changes"}
              </button>
              <button type="button" onClick={logout} className="btn-logout">
                🚪 Logout
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Profile;
