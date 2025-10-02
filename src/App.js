// App.js
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ReportForm from "./ReportForm";
import Dashboard from "./Dashboard";
import Login from "./Login";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // check token on load
    setIsAuthenticated(!!localStorage.getItem("token"));

    // optional: listen for changes to localStorage (e.g. logout from another tab)
    const handleStorageChange = () => {
      setIsAuthenticated(!!localStorage.getItem("token"));
    };
    window.addEventListener("storage", handleStorageChange);

    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<ReportForm />} />
        <Route path="/login" element={<Login setIsAuthenticated={setIsAuthenticated} />} />
        <Route
          path="/dashboard"
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />}
        />
      </Routes>
    </Router>
  );
}
