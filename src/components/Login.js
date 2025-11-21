import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import "../styles/Auth.css";

const Login = ({ onSwitchToRegister }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, error } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);
    if (result.success) {
      setUsername("");
      setPassword("");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>Web Chat</h1>
        <h2>Đăng Nhập</h2>

        {error && <div className="error-message">{error}</div>}

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
            <label>Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Đang đăng nhập..." : "Đăng Nhập"}
          </button>
        </form>

        <p className="switch-auth">
          Chưa có tài khoản?{" "}
          <span onClick={onSwitchToRegister} className="link">
            Đăng ký ngay
          </span>
        </p>
      </div>
    </div>
  );
};

export default Login;
