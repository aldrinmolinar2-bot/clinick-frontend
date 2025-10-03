import React, { useState, useEffect } from "react";

// Use deployed backend as fallback if env variable missing
const API =
  process.env.REACT_APP_API_URL || "https://clinick-backend.onrender.com";

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

  // Debug log whenever popup changes
  useEffect(() => {
    console.log("📢 Popup state changed:", popup);
    if (popup) alert("DEBUG: Popup should now be showing!");
  }, [popup]);

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

      console.log("📡 Server response:", res.status);

      if (res.ok) {
        console.log("✅ Report submitted successfully, showing popup...");
        setPopup(true);

        setForm({
          role: "",
          patientName: "",
          location: "",
          incident: "",
          severity: "",
          symptoms: "",
        });

        setTimeout(() => {
          console.log("⏱ Closing popup...");
          setPopup(false);
        }, 3000);
      } else {
        console.error("❌ Failed response:", res.status);
        alert("❌ Failed to submit. Please try again.");
      }
    } catch (err) {
      console.error("⚠️ Report submission error:", err);
      alert("⚠️ Server error. Please check your connection.");
    }
  };

  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "40px auto",
        fontFamily: "Arial, sans-serif",
      }}
    >
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
        <button type="submit" style={{ width: "100%", padding: "10px" }}>
          Submit Report
        </button>
      </form>

      {/* Popup */}
      {popup && (
        <>
          {/* Debug visible text */}
          <div style={{ color: "red", fontWeight: "bold", marginTop: "20px" }}>
            DEBUG: Popup is ACTIVE
          </div>

          {/* Overlay */}
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 9999,
            }}
          >
            <div
              style={{
                background: "#fff",
                padding: "25px 40px",
                borderRadius: "10px",
                textAlign: "center",
                boxShadow: "0 6px 15px rgba(0,0,0,0.3)",
              }}
            >
              <h2 style={{ color: "green", margin: 0 }}>
                ✅ The clinic has been alerted!
              </h2>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
