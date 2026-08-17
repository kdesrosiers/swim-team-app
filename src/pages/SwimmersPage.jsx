import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { listSwimmers, listRosterGroups, calculateAge } from "../api/swimmers";
import SwimmerModal from "../components/SwimmerModal";
import "./SwimmersPage.css";

function statusDot(active) {
  return (
    <span
      className="status-dot"
      style={{ background: active ? "#10b981" : "#ef4444" }}
      title={active ? "Active" : "Inactive"}
    />
  );
}

function SwimmersPage() {
  const [swimmers, setSwimmers]       = useState([]);
  const [groups, setGroups]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [selected, setSelected]       = useState(null);  // swimmer for open modal
  const [activeTab, setActiveTab]     = useState("info");
  const [activeCourse, setActiveCourse] = useState("SCY");

  // Load roster + groups on mount
  useEffect(() => {
    async function load() {
      try {
        const [sw, gr] = await Promise.all([listSwimmers(), listRosterGroups()]);
        setSwimmers(sw);
        setGroups(gr);
      } catch (e) {
        toast.error("Failed to load roster");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Client-side filter (search + group AND logic)
  const filtered = useMemo(() => {
    let list = [...swimmers].sort((a, b) => {
      const la = a.lastName.toLowerCase(), lb = b.lastName.toLowerCase();
      return la < lb ? -1 : la > lb ? 1 : 0;
    });
    if (groupFilter) {
      list = list.filter(s => String(s.group?._id) === groupFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s =>
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [swimmers, search, groupFilter]);

  function openModal(swimmer) {
    setSelected(swimmer);
    setActiveTab("info");
    setActiveCourse("SCY");
  }

  function closeModal() {
    setSelected(null);
  }

  /** Replace the swimmer in local state after a mutation succeeds. */
  function handleUpdate(updatedSwimmer) {
    setSwimmers(prev =>
      prev.map(s => s._id === updatedSwimmer._id ? updatedSwimmer : s)
    );
    setSelected(updatedSwimmer);
  }

  // Build group color map for avatar/badge lookup
  const groupColorMap = useMemo(() => {
    const m = {};
    groups.forEach(g => { m[g._id] = g.color || "#4f46e5"; });
    return m;
  }, [groups]);

  function getGroupColor(swimmer) {
    return swimmer.group?.color || groupColorMap[swimmer.group?._id] || "#4f46e5";
  }

  function initials(s) {
    return `${s.firstName.charAt(0)}${s.lastName.charAt(0)}`.toUpperCase();
  }

  function scyCount(s) {
    return (s.bestTimes || []).filter(t => t.course === "SCY" && t.isBest).length;
  }

  return (
    <div className="swimmers-page">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="sp-header">
        <h1 className="sp-title">Roster</h1>
        <span className="sp-count">{filtered.length} athlete{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="sp-filters">
        <input
          className="sp-search"
          type="text"
          placeholder="Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="sp-group-select"
          value={groupFilter}
          onChange={e => setGroupFilter(e.target.value)}
        >
          <option value="">All groups</option>
          {groups.map(g => (
            <option key={g._id} value={g._id}>{g.name}</option>
          ))}
        </select>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      {loading ? (
        <p className="sp-empty">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="sp-empty">No swimmers found.</p>
      ) : (
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead>
              <tr>
                <th className="sp-th sp-col-name">Name</th>
                <th className="sp-th sp-col-age">Age</th>
                <th className="sp-th sp-col-group">Group</th>
                <th className="sp-th sp-col-times">SCY Times</th>
                <th className="sp-th sp-col-status">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(swimmer => {
                const color = getGroupColor(swimmer);
                const age   = calculateAge(swimmer.dob);
                return (
                  <tr
                    key={swimmer._id}
                    className="sp-row"
                    onClick={() => openModal(swimmer)}
                  >
                    {/* Name + avatar */}
                    <td className="sp-td sp-col-name">
                      <div className="sp-name-cell">
                        <div
                          className="sp-avatar"
                          style={{ background: color, color: "#fff" }}
                        >
                          {initials(swimmer)}
                        </div>
                        <span className="sp-name-text">
                          {swimmer.lastName}, {swimmer.firstName}
                        </span>
                      </div>
                    </td>

                    {/* Age */}
                    <td className="sp-td sp-col-age">{age ?? "–"}</td>

                    {/* Group badge */}
                    <td className="sp-td sp-col-group">
                      {swimmer.group ? (
                        <span
                          className="sp-group-badge"
                          style={{
                            background: `${color}22`,
                            color,
                            borderColor: `${color}55`,
                          }}
                        >
                          {swimmer.group.name}
                        </span>
                      ) : (
                        <span className="sp-muted">—</span>
                      )}
                    </td>

                    {/* SCY best times count */}
                    <td className="sp-td sp-col-times">
                      {scyCount(swimmer) > 0 ? (
                        <span className="sp-times-count">{scyCount(swimmer)} SCY</span>
                      ) : (
                        <span className="sp-muted">—</span>
                      )}
                    </td>

                    {/* Status dot */}
                    <td className="sp-td sp-col-status">
                      {statusDot(swimmer.active !== false)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal ──────────────────────────────────────────────────────── */}
      {selected && (
        <SwimmerModal
          swimmer={selected}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeCourse={activeCourse}
          setActiveCourse={setActiveCourse}
          onClose={closeModal}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}

export default SwimmersPage;
