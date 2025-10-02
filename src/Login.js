// Login.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login({ setIsAuthenticated }) {
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === "clinick123") {
      localStorage.setItem("token", "clinick-token");
      setIsAuthenticated(true); // 👈 tell App.js to update state
      navigate("/dashboard");
    } else {
      alert("❌ Wrong password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-700">
          🔑 Clinic Login
        </h2>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-gray-600 mb-2 font-medium">
              Password
            </label>
            <input
              type="password"
              placeholder="Enter password"
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold shadow-md hover:bg-blue-700 transition"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
