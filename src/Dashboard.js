import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { requestPermission, listenForMessages } from "./firebase";

// Use env var if provided; otherwise default to your Render backend
const API = process.env.REACT_APP_API_URL || "https://clinick-backend.onrender.com";
const VALID_TOKEN = "clinick-token";
const ALARMED_STORAGE_KEY = "clinick-alarmed";

export default function Dashboard() {
  const [reports, setReports] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [activeAlarms, setActiveAlarms] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`; // YYYY-MM default (current month)
  });
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

  const activeAlarmsRef = useRef([]);
  const alarmedIdsRef = useRef(new Set());
  const pollingRef = useRef(null);

  const navigate = useNavigate();

  // Add manifest for installable app
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/manifest-dashboard.json";
    document.head.appendChild(link);
  }, []);

  // Notification permission + listener
  useEffect(() => {
    requestPermission();
    listenForMessages();
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

  // Stop an individual alarm and remove it
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

  // Trigger alarm for unseen report
  const triggerAlarmForReport = async (report) => {
    if (!report || !report._id) return;
    if (alarmedIdsRef.current.has(report._id)) return;

    try {
      const audio = new Audio("/siren.mp3");
      audio.loop = true;
      audio.play().catch((err) => {
        // autoplay may be blocked; still proceed
        console.warn("Autoplay blocked:", err);
      });

      const alarmObj = { id: report._id, location: report.location, audio };
      activeAlarmsRef.current = [...activeAlarmsRef.current, alarmObj];
      setActiveAlarms((prev) => [...prev, alarmObj]);
      alarmedIdsRef.current.add(report._id);
      persistAlarmedIds();

      // mark as seen in backend (best-effort)
      await fetch(`${API}/reports/${report._id}/seen`, { method: "PUT" }).catch((e) =>
        console.warn("Failed to mark seen:", e)
      );
    } catch (e) {
      console.error("triggerAlarmForReport error", e);
    }
  };

  // Fetch reports (filter by month/year when selectedMonth provided)
  const fetchReports = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token || token !== VALID_TOKEN) {
        // not logged in/authorized
        stopAllAlarms();
        return;
      }

      // Build URL and append query params only if month/year available
      const [year, month] = selectedMonth ? selectedMonth.split("-") : [];
      const url = new URL(`${API}/reports`);
      if (month && year) {
        // backend expects month as number 1-12
        url.searchParams.append("month", String(Number(month)));
        url.searchParams.append("year", String(Number(year)));
      }

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        console.error("Failed to fetch reports:", res.status);
        setReports([]); // clear on failure
        return;
      }

      const data = await res.json();
      const reportArray = Array.isArray(data) ? data : [];
      setReports(reportArray);

      // trigger alarms for unseen
      const unseen = reportArray.filter((r) => !r.seen);
      unseen.forEach((r) => triggerAlarmForReport(r));
    } catch (err) {
      console.error("Error fetching reports:", err);
      setReports([]);
    }
  };

  // initial load of alarmed IDs and cleanup on unmount
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fetch on mount and whenever selectedMonth changes; set polling as well
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || token !== VALID_TOKEN) return;

    fetchReports();

    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    pollingRef.current = setInterval(fetchReports, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    stopAllAlarms();
    navigate("/login");
  };

  const toggleSymptoms = (id) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Download CSV via backend endpoint
  const downloadCSV = () => {
    if (!selectedMonth) {
      alert("Please select a month first.");
      return;
    }
    const [year, month] = selectedMonth.split("-");
    const a = document.createElement("a");
    // ensure month is number (no leading zero); backend expects 1-12
    a.href = `${API}/export-reports?month=${String(Number(month))}&year=${String(Number(year))}`;
    a.download = `clinick-report-${year}-${month}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloadMenuOpen(false);
  };

  // Download PDF of current table
  const downloadPDF = () => {
    if (!selectedMonth) {
      alert("Please select a month first.");
      return;
    }
    try {
      if (!jsPDF) throw new Error("jsPDF not available");
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(16);
      doc.text("Clinick Dashboard Report", 14, 18);
      const [year, month] = selectedMonth.split("-");
      doc.setFontSize(11);
      doc.text(`Month: ${month}   Year: ${year}`, 14, 26);

      const rows = reports.map((r) => [
        r.role || "",
        r.patientName || "",
        r.location || "",
        r.incident || "",
        r.severity || "",
        (r.symptoms || "").replace(/\n/g, " "),
        r.createdAt ? new Date(r.createdAt).toLocaleString() : "",
      ]);

      // @ts-ignore
      doc.autoTable({
        startY: 34,
        head: [["Role", "Patient Name", "Location", "Incident", "Severity", "Symptoms", "Time"]],
        body: rows,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [22, 160, 133] },
      });

      doc.save(`clinick-report-${year}-${month}.pdf`);
    } catch (e) {
      console.error("downloadPDF error", e);
      alert("Unable to generate PDF. Make sure jspdf and jspdf-autotable are installed.");
    } finally {
      setDownloadMenuOpen(false);
    }
  };

  // Close download menu if clicked outside
  useEffect(() => {
    const onDocClick = (e) => {
      const menu = document.getElementById("download-menu");
      const btn = document.getElementById("download-btn");
      if (!menu || !btn) return;
      if (!menu.contains(e.target) && !btn.contains(e.target)) {
        setDownloadMenuOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // Small helper for table cell style
  const cellStyle = { border: "1px solid #000", padding: "8px", textAlign: "left", verticalAlign: "top" };
  const thStyle = { ...cellStyle, background: "#f2f2f2", fontWeight: "600" };

  return (
    <div style={{ maxWidth: "1000px", margin: "40px auto", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ marginBottom: "20px" }}>Clinic Dashboard</h1>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Month picker */}
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

          {/* Download dropdown */}
          <div style={{ position: "relative" }}>
            <button
              id="download-btn"
              onClick={() => setDownloadMenuOpen((s) => !s)}
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

            {downloadMenuOpen && (
              <div
                id="download-menu"
                style={{
                  position: "absolute",
                  top: "42px",
                  right: 0,
                  background: "white",
                  border: "1px solid #ccc",
                  borderRadius: "6px",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.1)",
                  zIndex: 1000,
                }}
              >
                <button
                  onClick={downloadCSV}
                  style={{
                    display: "block",
                    padding: "10px 16px",
                    width: "220px",
                    border: "none",
                    background: "transparent",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  📄 Download CSV
                </button>

                <button
                  onClick={downloadPDF}
                  style={{
                    display: "block",
                    padding: "10px 16px",
                    width: "220px",
                    border: "none",
                    background: "transparent",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  🖨️ Download PDF
                </button>
              </div>
            )}
          </div>

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

      {/* Active alarms modal(s) */}
      {activeAlarms.map((alarm) => (
        <div
          key={alarm.id}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <h2 style={{ color: "white", fontSize: "28px", marginBottom: "20px" }}>
            🚨 EMERGENCY ON {alarm.location}
          </h2>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={() => stopAlarm(alarm.id)}
              style={{
                padding: "20px 28px",
                fontSize: "18px",
                fontWeight: "bold",
                backgroundColor: "#e53e3e",
                color: "white",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                boxShadow: "0 0 20px rgba(255,0,0,0.8)",
              }}
            >
              STOP ALARM
            </button>
          </div>
        </div>
      ))}

      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", marginTop: "20px" }}>
        <thead>
          <tr>
            <th style={thStyle}>Role</th>
            <th style={thStyle}>Patient Name</th>
            <th style={thStyle}>Location</th>
            <th style={thStyle}>Incident</th>
            <th style={thStyle}>Severity</th>
            <th style={thStyle}>Symptoms</th>
            <th style={thStyle}>Time</th>
          </tr>
        </thead>

        <tbody>
          {reports.length === 0 ? (
            <tr>
              <td colSpan="7" style={{ ...cellStyle, textAlign: "center" }}>
                No reports for selected month
              </td>
            </tr>
          ) : (
            reports.map((r) => {
              const isExpanded = expandedRows[r._id] || false;
              const maxLength = 50;
              const symptoms = r.symptoms || "";
              return (
                <tr key={r._id || r.id}>
                  <td style={cellStyle}>{r.role || ""}</td>
                  <td style={cellStyle}>{r.patientName || ""}</td>
                  <td style={cellStyle}>{r.location || ""}</td>
                  <td style={cellStyle}>{r.incident || ""}</td>
                  <td style={cellStyle}>{r.severity || ""}</td>
                  <td style={cellStyle}>
                    {symptoms.length > maxLength && !isExpanded ? symptoms.substring(0, maxLength) + "..." : symptoms}
                    {symptoms.length > maxLength && (
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
                  <td style={cellStyle}>{r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
