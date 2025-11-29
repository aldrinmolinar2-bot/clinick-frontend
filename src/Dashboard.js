import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { requestPermission, listenForMessages } from "./firebase";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const VALID_TOKEN = "clinick-token";
const ALARMED_STORAGE_KEY = "clinick-alarmed";

export default function Dashboard() {
  const [reports, setReports] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [activeAlarms, setActiveAlarms] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(""); // YYYY-MM value

  const activeAlarmsRef = useRef([]);
  const alarmedIdsRef = useRef(new Set());
  const pollingRef = useRef(null);

  const navigate = useNavigate();

  // 📌 Add manifest for installable app
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/manifest-dashboard.json";
    document.head.appendChild(link);
  }, []);

  // 📌 Notification permission + listener
  useEffect(() => {
    requestPermission();
    listenForMessages();
  }, []);

  // 📌 Persist alarmed IDs
  const persistAlarmedIds = () => {
    try {
      const arr = Array.from(alarmedIdsRef.current);
      localStorage.setItem(ALARMED_STORAGE_KEY, JSON.stringify(arr));
    } catch {}
  };

  const loadAlarmedIds = () => {
    try {
      const raw = localStorage.getItem(ALARMED_STORAGE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        alarmedIdsRef.current = new Set(arr);
      }
    } catch {
      alarmedIdsRef.current = new Set();
    }
  };

  // 📌 Stop all alarms
  const stopAllAlarms = () => {
    try {
      activeAlarmsRef.current.forEach((a) => {
        if (a.audio) {
          a.audio.pause();
          a.audio.currentTime = 0;
        }
      });
    } finally {
      activeAlarmsRef.current = [];
      setActiveAlarms([]);
    }
  };

  // 📌 Trigger alarm for unseen report
  const triggerAlarmForReport = async (report) => {
    if (!report || !report._id) return;
    if (alarmedIdsRef.current.has(report._id)) return;

    try {
      const audio = new Audio("/siren.mp3");
      audio.loop = true;
      audio.play().catch(() => {});

      const alarmObj = { id: report._id, location: report.location, audio };
      activeAlarmsRef.current = [...activeAlarmsRef.current, alarmObj];
      setActiveAlarms((prev) => [...prev, alarmObj]);
      alarmedIdsRef.current.add(report._id);
      persistAlarmedIds();

      await fetch(`${API}/reports/${report._id}/seen`, { method: "PUT" });
    } catch {}
  };

  // 📌 Fetch reports with optional month filtering
  const fetchReports = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token || token !== VALID_TOKEN) {
        stopAllAlarms();
        return;
      }

      // Build query
      let url = `${API}/reports`;

      if (selectedMonth) {
        const [year, month] = selectedMonth.split("-");
        url += `?month=${month}&year=${year}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;

      const data = await res.json();
      const reportArray = Array.isArray(data) ? data : [];

      setReports(reportArray);

      // New unseen alarms
      const unseen = reportArray.filter((r) => !r.seen);
      unseen.forEach(triggerAlarmForReport);
    } catch {}
  };

  // 📌 Load alarms, stop on unmount
  useEffect(() => {
    loadAlarmedIds();
    stopAllAlarms();

    return () => {
      persistAlarmedIds();
      if (pollingRef.current) clearInterval(pollingRef.current);
      stopAllAlarms();
    };
  }, []);

  // 📌 Auto-fetch & poll every 5s
  useEffect(() => {
    fetchReports();
    pollingRef.current = setInterval(fetchReports, 5000);

    return () => clearInterval(pollingRef.current);
  }, [selectedMonth]); // refetch when month changes

  // 📌 Logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    stopAllAlarms();
    navigate("/login");
  };

  // 📌 Expand symptoms
  const toggleSymptoms = (id) =>
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));

  // 📌 Download CSV
  const downloadCSV = () => {
    if (!selectedMonth) return alert("Please select a month first.");

    const [year, month] = selectedMonth.split("-");
    const link = document.createElement("a");
    link.href = `${API}/export-reports?month=${month}&year=${year}`;
    link.download = `clinick-report-${year}-${month}.csv`;
    link.click();
  };

  // 📌 Export PDF that matches dashboard
  const downloadPDF = () => {
    if (!selectedMonth) return alert("Please select a month first.");

    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(18);
    doc.text("Clinick Monthly Report", 14, 15);

    const [year, month] = selectedMonth.split("-");
    doc.setFontSize(12);
    doc.text(`Month: ${month} / Year: ${year}`, 14, 25);

    const tableData = reports.map((r) => [
      r.role,
      r.patientName,
      r.location,
      r.incident,
      r.severity,
      r.symptoms,
      new Date(r.createdAt).toLocaleString(),
    ]);

    doc.autoTable({
      startY: 35,
      head: [["Role", "Patient Name", "Location", "Incident", "Severity", "Symptoms", "Time"]],
      body: tableData,
    });

    doc.save(`clinick-report-${year}-${month}.pdf`);
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "40px auto", fontFamily: "Arial, sans-serif" }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Clinic Dashboard</h1>

        <div style={{ display: "flex", gap: "10px" }}>
          {/* 📌 Month picker */}
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              cursor: "pointer",
            }}
          />

          {/* 📌 Export dropdown */}
          <div style={{ position: "relative" }}>
            <button
              onClick={(e) => {
                const menu = e.target.nextSibling;
                menu.style.display = menu.style.display === "block" ? "none" : "block";
              }}
              style={{
                padding: "8px 16px",
                backgroundColor: "#3182ce",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Download ▼
            </button>

            <div
              style={{
                display: "none",
                position: "absolute",
                right: 0,
                background: "white",
                border: "1px solid #ccc",
                borderRadius: "6px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                zIndex: 10,
              }}
            >
              <button
                onClick={downloadCSV}
                style={{
                  padding: "10px 20px",
                  border: "none",
                  width: "100%",
                  textAlign: "left",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Download CSV
              </button>
              <button
                onClick={downloadPDF}
                style={{
                  padding: "10px 20px",
                  border: "none",
                  width: "100%",
                  textAlign: "left",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Download PDF
              </button>
            </div>
          </div>

          {/* Logout */}
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
      </div>

      {/* 🚨 ALARM MODAL */}
      {activeAlarms.map((alarm) => (
        <div
          key={alarm.id}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <h2 style={{ color: "white", fontSize: "28px" }}>
            🚨 EMERGENCY ON {alarm.location}
          </h2>
        </div>
      ))}

      {/* TABLE */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
        <thead>
          <tr>
            <th>Role</th>
            <th>Patient</th>
            <th>Location</th>
            <th>Incident</th>
            <th>Severity</th>
            <th>Symptoms</th>
            <th>Time</th>
          </tr>
        </thead>

        <tbody>
          {reports.length === 0 ? (
            <tr>
              <td colSpan="7" style={{ textAlign: "center", padding: "10px" }}>
                No reports for selected month
              </td>
            </tr>
          ) : (
            reports.map((r) => {
              const expanded = expandedRows[r._id] || false;
              const maxLen = 50;
              return (
                <tr key={r._id}>
                  <td>{r.role}</td>
                  <td>{r.patientName}</td>
                  <td>{r.location}</td>
                  <td>{r.incident}</td>
                  <td>{r.severity}</td>
                  <td>
                    {expanded || r.symptoms.length <= maxLen
                      ? r.symptoms
                      : r.symptoms.substring(0, maxLen) + "..."}
                    {r.symptoms.length > maxLen && (
                      <button
                        onClick={() => toggleSymptoms(r._id)}
                        style={{
                          marginLeft: "8px",
                          border: "none",
                          color: "blue",
                          background: "none",
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        {expanded ? "Show less" : "Show more"}
                      </button>
                    )}
                  </td>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
