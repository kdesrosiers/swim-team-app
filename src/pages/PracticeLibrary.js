import React, { useEffect, useState } from "react";
import { listPractices } from "../api/practices";
import { getConfig } from "../api/config";
import PracticePreview from "../components/PracticePreview";
import "./PracticeBuilder.css"; // reuse button/input styles

const FALLBACK_ROSTERS = ["Gold/Platinum", "Gold", "Platinum", "Silver", "Bronze", "White", "Blue", "Yellow"];

/** Inline styles to avoid a new CSS file */
const styles = {
  page: { display: "flex", height: "100vh", background: "#f8fafc" },
  sidebar: {
    width: 240, background: "#202123", color: "#fff",
    display: "flex", flexDirection: "column", padding: "14px 12px",
    overflowY: "auto", borderRight: "1px solid #111318",
  },
  sbTitle: { fontSize: 14, fontWeight: 700, margin: "6px 6px 10px" },
  rosterList: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 },
  rosterBtn: (active) => ({
    width: "100%", textAlign: "left",
    background: active ? "#343541" : "transparent",
    color: "#e5e7eb",
    border: "1px solid " + (active ? "#3f4045" : "#2a2b32"),
    padding: "10px 12px", borderRadius: 8, cursor: "pointer",
  }),

  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  headerBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 18px", borderBottom: "1px solid #e5e7eb", background: "#fff",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 10, fontWeight: 700 },
  headerRight: { display: "flex", alignItems: "center", gap: 12 },

  content: { flex: 1, display: "grid", gridTemplateRows: "auto 1fr auto auto", rowGap: 12, padding: 16, overflowY: "auto" },
  list: { display: "grid", gridTemplateColumns: "1fr", gap: 10 },
  card: (active) => ({
    background: "#fff", borderRadius: 10, padding: "12px 14px",
    border: "1px solid " + (active ? "#94a3b8" : "#e5e7eb"),
    boxShadow: active ? "0 1px 6px rgba(15,23,42,0.08)" : "none",
    cursor: "pointer",
  }),
  cardMetaRow: { display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: 12, marginTop: 4 },
  pager: { display: "flex", alignItems: "center", gap: 8, marginTop: 2 },
  preview: { background: "#fff", borderRadius: 10, padding: 16, border: "1px solid #e5e7eb" },
};

export default function PracticeLibrary() {
  // Config-driven rosters
  const [rosters, setRosters] = useState(FALLBACK_ROSTERS);
  const [defaultRoster, setDefaultRoster] = useState(FALLBACK_ROSTERS[0]);
  const [practiceSchedule, setPracticeSchedule] = useState(null);

  // UI state
  const [roster, setRoster] = useState(FALLBACK_ROSTERS[0]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState("06:00");

  // Load config once (rosters, defaultRoster, practiceSchedule)
  useEffect(() => {
    (async () => {
      try {
        const cfg = await getConfig(); // { rosters, defaultRoster, practiceSchedule, ... }
        const cfgRosters = Array.isArray(cfg?.rosters) && cfg.rosters.length ? cfg.rosters : FALLBACK_ROSTERS;
        const cfgDefault = cfg?.defaultRoster && cfgRosters.includes(cfg.defaultRoster)
          ? cfg.defaultRoster
          : cfgRosters[0];

        setRosters(cfgRosters);
        setDefaultRoster(cfgDefault);
        setPracticeSchedule(cfg?.practiceSchedule || null);

        // initialize selected roster from config
        setRoster(cfgDefault);
      } catch {
        // fall back silently
        setRosters(FALLBACK_ROSTERS);
        setDefaultRoster(FALLBACK_ROSTERS[0]);
        setRoster(FALLBACK_ROSTERS[0]);
      }
    })();
  }, []);

  // When roster changes, optionally auto-fill start time from schedule (for today's weekday)
  useEffect(() => {
    if (!practiceSchedule || !roster) return;
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];
    const sched = practiceSchedule[roster]?.[day];
    if (sched && sched !== "OFF") setStartTime(sched);
  }, [roster, practiceSchedule]);

  async function refresh(p = 1) {
    setLoading(true);
    try {
      const res = await listPractices({ roster, q, page: p, limit: 20 });
      setRows(res.items || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);

      if (!selected && res.items?.length) setSelected(res.items[0]);
      if (selected && !res.items?.some(i => i._id === selected._id)) {
        setSelected(res.items[0] || null);
      }
    } finally {
      setLoading(false);
    }
  }

  // Reload on roster change
  useEffect(() => { if (roster) refresh(1); /* eslint-disable-next-line */ }, [roster]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => refresh(1), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q]);

  return (
    <div style={styles.page}>
      {/* Sidebar (rosters from config) */}
      <aside style={styles.sidebar}>
        <div style={styles.sbTitle}>Rosters</div>
        <ul style={styles.rosterList}>
          {rosters.map((r) => (
            <li key={r}>
              <button
                style={styles.rosterBtn(roster === r)}
                onClick={() => { setRoster(r); setSelected(null); }}
                className="add-btn"
              >
                {r}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main area */}
      <div style={styles.main}>
        {/* Top toolbar */}
        <div style={styles.headerBar}>
          <div style={styles.headerLeft}>
            <span style={{ fontSize: 16 }}>{roster}</span>
            <span style={{ color: "#94a3b8", fontWeight: 500 }}>Practice Library</span>
          </div>
          <div style={styles.headerRight}>
            <label className="pair">
              <span>Search:</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="title or text..." />
            </label>
            <label className="pair">
              <span>Start:</span>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} step={60} />
            </label>
          </div>
        </div>

        {/* Content: list + pager + preview */}
        <div style={styles.content}>
          {/* List */}
          <div style={styles.list}>
            {rows.map((p) => (
              <div
                key={p._id}
                style={styles.card(selected?._id === p._id)}
                onClick={() => setSelected(p)}
              >
                <div style={{ fontWeight: 700 }}>{p.title || `Practice ${p.date}`}</div>
                <div style={styles.cardMetaRow}>
                  <span>{p.date}</span>
                  <span>{p.roster}</span>
                </div>
              </div>
            ))}
            {!rows.length && !loading && (
              <div style={{ color: "#64748b", fontStyle: "italic" }}>No practices found.</div>
            )}
          </div>

          {/* Pager */}
          <div style={styles.pager}>
            <button className="add-btn light" disabled={page <= 1} onClick={() => refresh(page - 1)}>Prev</button>
            <button className="add-btn light" disabled={page * 20 >= total} onClick={() => refresh(page + 1)}>Next</button>
            <div style={{ marginLeft: "auto", color: "#6b7280" }}>{total} total</div>
          </div>

          {/* Preview */}
          <div style={styles.preview}>
            {selected ? (
              <PracticePreview practice={selected} startTime={startTime} />
            ) : (
              <div style={{ color: "#6b7280" }}>Select a practice to preview.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
