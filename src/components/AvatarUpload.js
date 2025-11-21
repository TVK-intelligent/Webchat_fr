import React, { useState } from "react";
import { userService } from "../services/api";
import { getFullAvatarUrl } from "../utils/avatarUtils";
import "../styles/AvatarUpload.css";

const AvatarUpload = ({ user, onAvatarUpdate }) => {
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(() => {
    if (user?.avatarUrl) {
      return getFullAvatarUrl(user.avatarUrl);
    }
    return "";
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("Kích thước file không được vượt quá 5MB");
        return;
      }

      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Vui lòng chọn file hình ảnh");
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

  const handleUploadAvatar = async (e) => {
    e.preventDefault();

    if (!avatarFile) {
      setError("Vui lòng chọn ảnh");
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();
      formData.append("avatar", avatarFile);

      console.log("Uploading avatar...");
      const response = await userService.uploadAvatar(user.id, formData);

      console.log("Avatar uploaded:", response.data);

      setMessage("Cập nhật ảnh đại diện thành công!");
      setAvatarFile(null);

      // Callback to parent to update user
      if (onAvatarUpdate) {
        onAvatarUpdate(response.data);
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.message || err.message || "Cập nhật ảnh thất bại";
      setError(errorMsg);
      console.error("Error uploading avatar:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="avatar-upload-container">
      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      <div className="avatar-upload-form">
        <div className="avatar-preview-container">
          <div className="avatar-preview">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar preview" />
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
              Chọn Ảnh
            </label>
            <p className="upload-hint-sm">
              Tối đa 5MB
              <br />
              JPG, PNG, GIF
            </p>

            {avatarFile && (
              <button
                type="button"
                onClick={handleUploadAvatar}
                disabled={loading}
                className="btn-upload-sm"
              >
                {loading ? "Đang tải..." : "Tải Lên"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvatarUpload;
