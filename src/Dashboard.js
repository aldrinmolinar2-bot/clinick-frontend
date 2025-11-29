import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { requestPermission, listenForMessages } from "./firebase";

// 🔹 FORCE CORRECT BACKEND — VERCEL NEEDS ABSOLUTE URL
const API = "https://clinick-backend.onrender.com";

const VALID_TOKEN = "clinick-token";
const ALARMED_STORAGE_KEY = "clinick-alarmed";

export default function Dashboard() {
  const [reports, setReports] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [activeAlarms, setActiveAlarms] = useState([]);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

  // DEFAULT MONTH = CURRENT
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });

  const activeAlarmsRef = useRef([]);
  const alarmedIdsRef = useRef(new Set());
  const pollingRef = useRef(null);

  const navigate = useNavigate();

  // Manifest
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/manifest-dashboard.json";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    requestPermission();
    listenForMessages();
  }, []);

  const persistAlarmedIds = () => {
    try {
      const arr = Array.from(alarmedIdsRef.current);
      localStorage.setItem(ALARMED_STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {}
  };

  const loadAlarmedIds = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(ALARMED_STORAGE_KEY));
      if (Array.isArray(saved)) alarmedIdsRef.current = new Set(saved);
    } catch {}
  };

  // Stop all alarms
  const stopAllAlarms = () => {
    activeAlarmsRef.current.forEach((a) => {
      if (a.audio) {
        try {
          a.audio.pause();
          a.audio.currentTime = 0;
        } catch {}
      }
    });
    activeAlarmsRef.current = [];
    setActiveAlarms([]);
  };

  const stopAlarm = (id) => {
    activeAlarmsRef.current.forEach((a) => {
      if (a.id === id && a.audio) {
        try {
          a.audio.pause();
          a.audio.currentTime = 0;
        } catch {}
      }
    });
    activeAlarmsRef.current = activeAlarmsRef.current.filter((a) => a.id !== id);
    setActiveAlarms((old) => old.filter((a) => a.id !== id));
  };

  // Trigger alarm for unseen report
  const triggerAlarmForReport = async (report) => {
    if (!report || !report._id) return;
    if (alarmedIdsRef.current.has(report._id)) return;

    try {
      const audio = new Audio("/siren.mp3");
      audio.loop = true;
      audio.play().catch(() => {});

      const alarmObj = { id: report._id, location: report.location, audio };
      activeAlarmsRef.current.push(alarmObj);
      setActiveAlarms([...activeAlarmsRef.current]);
      alarmedIdsRef.current.add(report._id);
      persistAlarmedIds();

      await fetch(`${API}/reports/${report._id}/seen`, { method: "PUT" });
    } catch {}
  };

  // 🔥🔥 FIXED MONTHLY FILTER 🔥🔥
  const fetchReports = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token || token !== VALID_TOKEN) {
        stopAllAlarms();
        return;
      }

      const [year, month] = selectedMonth.split("-");

      const res = await fetch(
        `${API}/reports?month=${Number(month)}&year=${Number(year)}`
      );

      if (!res.ok) {
        setReports([]);
        return;
      }

      const data = await res.json();
      setReports(data);

      // Fire alarms
      data.filter((r) => !r.seen).forEach(triggerAlarmForReport);
    } catch {
      setReports([]);
    }
  };

  // Load alarms + setup cleanup
  useEffect(() => {
    loadAlarmedIds();
    stopAllAlarms();
    return () => {
      persistAlarmedIds();
      stopAllAlarms();
    };
  }, []);

  // Poll every time month changes
  useEffect(() => {
    fetchReports();
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(fetchReports, 5000);

    return () => clearInterval(pollingRef.current);
  }, [selectedMonth]);

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    stopAllAlarms();
    navigate("/login");
  };

  const toggleSymptoms = (id) =>
    setExpandedRows((p) => ({ ...p, [id]: !p[id] }));

  // CSV DOWNLOAD FIXED (absolute URL)
  const downloadCSV = () => {
    const [year, month] = selectedMonth.split("-");
    window.open(
      `${API}/export-reports?month=${Number(month)}&year=${Number(year)}`,
      "_blank"
    );
    setDownloadMenuOpen(false);
  };

  // PDF FIXED
  const downloadPDF = () => {
    const [year, month] = selectedMonth.split("-");
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(16);
    doc.text("Clinick Dashboard Report", 14, 20);

    doc.setFontSize(12);
    doc.text(`Month: ${month} | Year: ${year}`, 14, 28);

    const rows = reports.map((r) => [
      r.role,
      r.patientName,
      r.location,
      r.incident,
      r.severity,
      r.symptoms,
      new Date(r.createdAt).toLocaleString(),
    ]);

    doc.autoTable({
      startY: 34,
      head: [["Role", "Patient Name", "Location", "Incident", "Severity", "Symptoms", "Time"]],
      body: rows,
      styles: { fontSize: 9 },
    });

    doc.save(`clinick-report-${year}-${month}.pdf`);
    setDownloadMenuOpen(false);
  };

  // Close menu
  useEffect(() => {
    const close = (e) => {
      const menu = document.getElementById("download-menu");
      const btn = document.getElementById("download-btn");
      if (menu && !menu.contains(e.target) && btn && !btn.contains(e.target)) {
        setDownloadMenuOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const th = { padding: 8, border: "1px solid #000", background: "#eee" };
  const td = { padding: 8, border: "1px solid #000" };

  return (
    <div style={{ maxWidth: "1000px", margin: "40px auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>Clinic Dashboard</h1>

        <div style={{ display: "flex", gap: "10px" }}>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: 8, borderRadius: 6 }}
          />

          {/* Download */}
          <div style={{ position: "relative" }}>
            <button
              id="download-btn"
              onClick={() => setDownloadMenuOpen((s) => !s)}
              style={{
                padding: "8px 16px",
                background: "#3182ce",
                color: "#fff",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Download ▼
            </button>

            {downloadMenuOpen && (
              <div
                id="download-menu"
                style={{
                  position: "absolute",
                  top: 40,
                  right: 0,
                  background: "white",
                  border: "1px solid #ccc",
                  borderRadius: 6,
                }}
              >
                <button onClick={downloadCSV} style={{ padding: 10, display: "block", width: 200 }}>
                  📄 Download CSV
                </button>

                <button onClick={downloadPDF} style={{ padding: 10, display: "block", width: 200 }}>
                  🖨️ Download PDF
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            style={{
              padding: "8px 16px",
              background: "#e53e3e",
              color: "#fff",
              borderRadius: 6,
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Alarms */}
      {activeAlarms.map((a) => (
        <div
          key={a.id}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <div style={{ color: "#fff", fontSize: 24, marginBottom: 20 }}>
            🚨 EMERGENCY ON {a.location}
          </div>
          <button
            onClick={() => stopAlarm(a.id)}
            style={{
              padding: "20px 30px",
              background: "#e53e3e",
              color: "#fff",
              fontSize: 20,
              borderRadius: 10,
            }}
          >
            STOP ALARM
          </button>
        </div>
      ))}

      {/* Table */}
      <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 20 }}>
        <thead>
          <tr>
            <th style={th}>Role</th>
            <th style={th}>Patient Name</th>
            <th style={th}>Location</th>
            <th style={th}>Incident</th>
            <th style={th}>Severity</th>
            <th style={th}>Symptoms</th>
            <th style={th}>Time</th>
          </tr>
        </thead>

        <tbody>
          {reports.length === 0 ? (
            <tr>
              <td colSpan="7" style={{ textAlign: "center", padding: 20 }}>
                No reports for selected month
              </td>
            </tr>
          ) : (
            reports.map((r) => {
              const isExpanded = expandedRows[r._id];
              const maxLength = 50;
              return (
                <tr key={r._id}>
                  <td style={td}>{r.role}</td>
                  <td style={td}>{r.patientName}</td>
                  <td style={td}>{r.location}</td>
                  <td style={td}>{r.incident}</td>
                  <td style={td}>{r.severity}</td>
                  <td style={td}>
                    {(r.symptoms || "").length > maxLength && !isExpanded
                      ? r.symptoms.substring(0, maxLength) + "..."
                      : r.symptoms}
                    {(r.symptoms || "").length > maxLength && (
                      <button
                        onClick={() => toggleSymptoms(r._id)}
                        style={{
                          marginLeft: 8,
                          color: "blue",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        {isExpanded ? "Show less" : "Show more"}
                      </button>
                    )}
                  </td>
                  <td style={td}>{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
