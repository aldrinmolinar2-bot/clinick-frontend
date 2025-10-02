import React, { useState } from "react";
const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ReportForm() {
  const [form, setForm] = useState({
    role: "",
    patientName: "",
    location: "",
    incident: "",
    severity: "",
    symptoms: "",
  });
  const [popup, setPopup] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setPopup(true);
        setForm({
          role: "",
          patientName: "",
          location: "",
          incident: "",
          severity: "",
          symptoms: "",
        });
        setTimeout(() => setPopup(false), 3000);
      } else {
        alert("❌ Failed to submit");
      }
    } catch (err) {
      alert("⚠️ Server error");
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ textAlign: "center", marginBottom: "20px" }}>Clinick</h1>

      <form onSubmit={handleSubmit}>
        {/* Role */}
        <label>Role</label>
        <select
          name="role"
          value={form.role}
          onChange={handleChange}
          required
          style={{ width: "100%", marginBottom: "10px" }}
        >
          <option value="">Select Role</option>
          <option value="Student">Student</option>
          <option value="Teacher">Teacher</option>
          <option value="Staff">Staff</option>
        </select>

        {/* Patient Name */}
        <label>Patient Name</label>
        <input
          type="text"
          name="patientName"
          value={form.patientName}
          onChange={handleChange}
          required
          style={{ width: "100%", marginBottom: "10px" }}
        />

        {/* Location */}
        <label>Location</label>
        <input
          type="text"
          name="location"
          value={form.location}
          onChange={handleChange}
          required
          style={{ width: "100%", marginBottom: "10px" }}
        />

        {/* Incident */}
        <label>Incident</label>
        <input
          type="text"
          name="incident"
          value={form.incident}
          onChange={handleChange}
          required
          style={{ width: "100%", marginBottom: "10px" }}
        />

        {/* Severity */}
        <label>Severity</label>
        <select
          name="severity"
          value={form.severity}
          onChange={handleChange}
          required
          style={{ width: "100%", marginBottom: "10px" }}
        >
          <option value="">Select Severity</option>
          <option value="Mild">Mild</option>
          <option value="Moderate">Moderate</option>
          <option value="Severe">Severe</option>
        </select>

        {/* Symptoms */}
        <label>Symptoms</label>
        <textarea
          name="symptoms"
          value={form.symptoms}
          onChange={handleChange}
          rows="3"
          required
          style={{ width: "100%", marginBottom: "10px" }}
        />

        {/* Submit */}
        <button type="submit" style={{ width: "100%", padding: "8px" }}>
          Submit Report
        </button>
      </form>

      {/* Popup */}
      {popup && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div style={{ background: "#fff", padding: "20px", borderRadius: "5px" }}>
            <h2 style={{ color: "green" }}>✅ The clinic has been alerted!</h2>
          </div>
        </div>
      )}
    </div>
  );
}
