import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { requestPermission, listenForMessages } from "./firebase"; // ✅ added import

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const VALID_TOKEN = "clinick-token";
const ALARMED_STORAGE_KEY = "clinick-alarmed";

export default function Dashboard() {
  const [reports, setReports] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [activeAlarms, setActiveAlarms] = useState([]);

  const activeAlarmsRef = useRef([]);
  const alarmedIdsRef = useRef(new Set());
  const pollingRef = useRef(null);

  const navigate = useNavigate();

  // ✅ Load dashboard manifest for installable dashboard app
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/manifest-dashboard.json";
    document.head.appendChild(link);
  }, []);

  // ✅ Ask for notification permission and set up listener on load
  useEffect(() => {
    requestPermission(); // get FCM token and send to backend
    listenForMessages(); // handle foreground notifications
  }, []);

  // Persist alarmed IDs
  const persistAlarmedIds = () => {
    try {
      const arr = Array.from(alarmedIdsRef.current);
      localStorage.setItem(ALARMED_STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {
      console.error("persistAlarmedIds error", e);
    }
  };

  // Load alarmed IDs from storage
  const loadAlarmedIds = () => {
    try {
      const raw = localStorage.getItem(ALARMED_STORAGE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        alarmedIdsRef.current = new Set(arr);
      }
    } catch (e) {
      console.warn("loadAlarmedIds failed - resetting", e);
      alarmedIdsRef.current = new Set();
    }
  };

  // Stop all alarms
  const stopAllAlarms = () => {
    try {
      activeAlarmsRef.current.forEach((a) => {
        if (a.audio) {
          try {
            a.audio.pause();
            a.audio.currentTime = 0;
          } catch (e) {}
        }
      });
    } finally {
      activeAlarmsRef.current = [];
      setActiveAlarms([]);
    }
  };

  // Trigger alarm for unseen report
  const triggerAlarmForReport = async (report) => {
    if (!report || !report._id) return;
    if (alarmedIdsRef.current.has(report._id)) return;

    try {
      const audio = new Audio("/siren.mp3");
      audio.loop = true;
      audio.play().catch((err) => console.error("Autoplay blocked:", err));

      const alarmObj = { id: report._id, location: report.location, audio };
      activeAlarmsRef.current = [...activeAlarmsRef.current, alarmObj];
      setActiveAlarms((prev) => [...prev, alarmObj]);
      alarmedIdsRef.current.add(report._id);
      persistAlarmedIds();

      // ✅ mark as seen in backend
      await fetch(`${API}/reports/${report._id}/seen`, { method: "PUT" });
    } catch (e) {
      console.error("triggerAlarmForReport error", e);
    }
  };

  // Fetch reports
  const fetchReports = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token || token !== VALID_TOKEN) {
        stopAllAlarms();
        return;
      }

      const res = await fetch(`${API}/reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        console.error("Failed to fetch reports:", res.status);
        return;
      }
      const data = await res.json();
      const reportArray = Array.isArray(data) ? data : [];
      setReports(reportArray);

      // Find unseen reports
      const unseen = reportArray.filter((r) => !r.seen);
      unseen.forEach((r) => triggerAlarmForReport(r));
    } catch (err) {
      console.error("Error fetching reports:", err);
    }
  };

  useEffect(() => {
    loadAlarmedIds();
    stopAllAlarms();

    return () => {
      persistAlarmedIds();
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      stopAllAlarms();
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || token !== VALID_TOKEN) return;

    fetchReports();
    pollingRef.current = setInterval(fetchReports, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    stopAllAlarms();
    navigate("/login");
  };

  const stopAlarm = (id) => {
    activeAlarmsRef.current.forEach((a) => {
      if (a.id === id && a.audio) {
        try {
          a.audio.pause();
          a.audio.currentTime = 0;
        } catch (e) {}
      }
    });
    activeAlarmsRef.current = activeAlarmsRef.current.filter((a) => a.id !== id);
    setActiveAlarms((prev) => prev.filter((a) => a.id !== id));
  };

  const toggleSymptoms = (id) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "40px auto", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ marginBottom: "20px" }}>Clinic Dashboard</h1>
        <button
  onClick={() => {
    const m = prompt("Enter month (1-12):");
    const y = prompt("Enter year (e.g. 2025):");

    if (!m || !y) return;

    const link = document.createElement("a");
    link.href = `${API}/export-reports?month=${m}&year=${y}`;
    link.download = `clinick-report-${y}-${m}.csv`;
    link.click();
  }}
  style={{
    padding: "8px 16px",
    backgroundColor: "#3182ce",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginRight: "10px"
  }}
>
  Download Reports
</button>

        <button
          onClick={handleLogout}
          style={{
            padding: "8px 16px",
            backgroundColor: "#e53e3e",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>

      {activeAlarms.map((alarm) => (
        <div
          key={alarm.id}
          style={{
            position: "fixed",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            zIndex: "9999",
          }}
        >
          <h2 style={{ color: "white", fontSize: "28px", marginBottom: "20px" }}>
            🚨 EMERGENCY ON {alarm.location}
          </h2>
          <button
            onClick={() => stopAlarm(alarm.id)}
            style={{
              padding: "20px 40px",
              fontSize: "24px",
              fontWeight: "bold",
              backgroundColor: "#e53e3e",
              color: "white",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              boxShadow: "0 0 20px rgba(255,0,0,0.8)",
              animation: "pulse 1s infinite",
            }}
          >
            STOP ALARM
          </button>
        </div>
      ))}

      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000" }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #000", padding: "8px" }}>Role</th>
            <th style={{ border: "1px solid #000", padding: "8px" }}>Patient Name</th>
            <th style={{ border: "1px solid #000", padding: "8px" }}>Location</th>
            <th style={{ border: "1px solid #000", padding: "8px" }}>Incident</th>
            <th style={{ border: "1px solid #000", padding: "8px" }}>Severity</th>
            <th style={{ border: "1px solid #000", padding: "8px" }}>Symptoms</th>
            <th style={{ border: "1px solid #000", padding: "8px" }}>Time</th>
          </tr>
        </thead>
        <tbody>
          {reports.length === 0 ? (
            <tr>
              <td colSpan="7" style={{ textAlign: "center", padding: "10px" }}>
                No reports yet
              </td>
            </tr>
          ) : (
            reports.map((r) => {
              const isExpanded = expandedRows[r._id] || false;
              const maxLength = 50;
              return (
                <tr key={r._id}>
                  <td style={{ border: "1px solid #000", padding: "8px" }}>{r.role}</td>
                  <td style={{ border: "1px solid #000", padding: "8px" }}>{r.patientName}</td>
                  <td style={{ border: "1px solid #000", padding: "8px" }}>{r.location}</td>
                  <td style={{ border: "1px solid #000", padding: "8px" }}>{r.incident}</td>
                  <td style={{ border: "1px solid #000", padding: "8px" }}>{r.severity}</td>
                  <td style={{ border: "1px solid #000", padding: "8px" }}>
                    {r.symptoms.length > maxLength && !isExpanded
                      ? r.symptoms.substring(0, maxLength) + "..."
                      : r.symptoms}
                    {r.symptoms.length > maxLength && (
                      <button
                        onClick={() => toggleSymptoms(r._id)}
                        style={{
                          marginLeft: "8px",
                          border: "none",
                          background: "none",
                          color: "blue",
                          cursor: "pointer",
                          textDecoration: "underline",
                          fontSize: "12px",
                        }}
                      >
                        {isExpanded ? "Show less" : "Show more"}
                      </button>
                    )}
                  </td>
                  <td style={{ border: "1px solid #000", padding: "8px" }}>
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
