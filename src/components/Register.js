import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import "../styles/Auth.css";

const Register = ({ onSwitchToLogin }) => {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const { register, error } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessage("Mật khẩu không khớp!");
      return;
    }

    setLoading(true);
    const result = await register(username, password, displayName);
    setLoading(false);

    if (result.success) {
      setMessage("Đăng ký thành công! Vui lòng đăng nhập.");
      setUsername("");
      setDisplayName("");
      setPassword("");
      setConfirmPassword("");
      setTimeout(onSwitchToLogin, 1500);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>Web Chat</h1>
        <h2>📝 Đăng Ký</h2>

        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Tên người dùng</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tên người dùng"
              required
            />
          </div>

          <div className="form-group">
            <label>Tên hiển thị</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nhập tên hiển thị"
            />
          </div>

          <div className="form-group">
            <label>Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              required
            />
          </div>

          <div className="form-group">
            <label>Xác nhận mật khẩu</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Xác nhận mật khẩu"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Đang đăng ký..." : "✅ Đăng Ký"}
          </button>
        </form>

        <p className="switch-auth">
          Đã có tài khoản?{" "}
          <span onClick={onSwitchToLogin} className="link">
            Đăng nhập
          </span>
        </p>
      </div>
    </div>
  );
};

export default Register;
