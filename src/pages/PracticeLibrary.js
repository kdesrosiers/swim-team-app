import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listPractices } from "../api/practices";
import { getConfig } from "../api/config";
import { getSeasons } from "../api/seasons";
import PracticePreview from "../components/PracticePreview";
import "./PracticeLibrary.css";

const FALLBACK_ROSTERS = ["Gold/Platinum", "Gold", "Platinum", "Silver", "Bronze", "White", "Blue", "Yellow"];

export default function PracticeLibrary() {
  const navigate = useNavigate();

  // Config-driven rosters
  const [rosters, setRosters] = useState(FALLBACK_ROSTERS);
  const [defaultRoster, setDefaultRoster] = useState(FALLBACK_ROSTERS[0]);
  const [practiceSchedule, setPracticeSchedule] = useState(null);

  // Seasons
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState("all");

  // UI state
  const [roster, setRoster] = useState(FALLBACK_ROSTERS[0]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState("06:00");

  // Load config and seasons once
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

      // Load seasons
      try {
        const seasonsData = await getSeasons();
        setSeasons(seasonsData?.seasons || []);
      } catch (e) {
        console.error("Failed to load seasons", e);
        setSeasons([]);
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
      const params = { roster, q, page: p, limit: 10 }; // Show 10 practices per page
      if (selectedSeason && selectedSeason !== "all") {
        params.season = selectedSeason;
      }
      const res = await listPractices(params);
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

  // Reload on roster or season change
  useEffect(() => { if (roster) refresh(1); /* eslint-disable-next-line */ }, [roster, selectedSeason]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => refresh(1), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q]);

  // Navigate to Practice Builder with practice data
  function handleEdit() {
    if (!selected) return;
    // Pass practice data with edit mode
    navigate("/builder", {
      state: {
        mode: "edit",
        practice: selected
      }
    });
  }

  function handleUseTemplate() {
    if (!selected) return;
    // Pass practice data but with today's date
    const today = new Date().toISOString().split('T')[0];
    navigate("/builder", {
      state: {
        mode: "template",
        practice: { ...selected, date: today }
      }
    });
  }

  return (
    <div className="practice-library-page">
      {/* Roster Sidebar */}
      <aside className="roster-sidebar">
        <div className="roster-sidebar-header">Rosters</div>
        <ul className="roster-list">
          {rosters.map((r) => (
            <li key={r}>
              <button
                className={`roster-btn ${roster === r ? 'active' : ''}`}
                onClick={() => { setRoster(r); setSelected(null); }}
              >
                {r}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Practice List Sidebar (shows when roster selected) */}
      {roster && (
        <div className="practice-list-sidebar">
          <div className="practice-list-header">
            <div className="practice-list-filters-title">Filters</div>
            <div className="practice-list-filter">
              <label>Season:</label>
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
              >
                <option value="all">All Seasons</option>
                {seasons.map((s) => (
                  <option key={s.id || s.title} value={s.title}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="practice-list-filter">
              <label>Search:</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="keyword..."
              />
            </div>
          </div>

          <div className="practice-list-content">
            {loading && <div className="practice-list-loading">Loading...</div>}
            {!loading && rows.length === 0 && <div className="practice-list-empty">No practices found</div>}
            {!loading && rows.map((p) => (
              <div
                key={p._id}
                className={`practice-card ${selected?._id === p._id ? 'active' : ''}`}
                onClick={() => setSelected(p)}
              >
                <div className="practice-card-title">
                  {p.title || `Practice ${p.date}`}
                </div>
                <div className="practice-card-meta">
                  <span>{p.date}</span>
                  {p.season && (
                    <>
                      <span>•</span>
                      <span className="practice-card-season">{p.season}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Footer */}
          {!loading && total > 0 && (
            <div className="practice-list-footer">
              <button
                className="pagination-btn"
                onClick={() => refresh(page - 1)}
                disabled={page <= 1}
              >
                ← Prev
              </button>
              <div className="pagination-info">
                <div>Page {page}</div>
                <div>{total} total</div>
              </div>
              <button
                className="pagination-btn"
                onClick={() => refresh(page + 1)}
                disabled={page * 10 >= total}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="practice-main-content">
        {/* Top Header Bar */}
        <div className="practice-header-bar">
          <div className="practice-header-left">
            <span className="practice-header-title">📚 Practice Library</span>
            {roster && <span className="practice-header-roster">• {roster}</span>}
          </div>
          <div className="practice-header-right">
            <label className="pair">
              <span>Start:</span>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} step={60} />
            </label>
          </div>
        </div>

        {/* Practice Preview (Main Focus) */}
        <div className="practice-preview-area">
          {selected && (
            <div className="practice-actions">
              <button className="btn-edit" onClick={handleEdit}>
                ✏️ Edit
              </button>
              <button className="btn-template" onClick={handleUseTemplate}>
                📋 Use Template
              </button>
            </div>
          )}
          <div className="practice-preview-card">
            {selected ? (
              <PracticePreview practice={selected} startTime={startTime} />
            ) : rows.length === 0 && !loading && roster ? (
              <div className="practice-empty-state">
                <div className="practice-empty-icon">📋</div>
                <div className="practice-empty-title">No practices found</div>
                <div className="practice-empty-text">Try adjusting your filters or search query</div>
              </div>
            ) : !roster ? (
              <div className="practice-empty-state">
                <div className="practice-empty-icon">👈</div>
                <div className="practice-empty-title">Select a roster to begin</div>
              </div>
            ) : (
              <div className="practice-empty-state">
                <div className="practice-empty-icon">👈</div>
                <div className="practice-empty-title">Select a practice to view</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
