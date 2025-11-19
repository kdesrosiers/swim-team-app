import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import {
  listSwimmers,
  listRosterGroups,
  listLocations,
  deleteSwimmer,
  calculateAge,
} from "../api/swimmers";
import SwimmerForm from "../components/SwimmerForm";
import SwimmerDetailView from "../components/SwimmerDetailView";
import RosterGroupManager from "../components/RosterGroupManager";
import "./SwimmerRoster.css";

function SwimmerRoster() {
  const [swimmers, setSwimmers] = useState([]);
  const [rosterGroups, setRosterGroups] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [selectedSwimmer, setSelectedSwimmer] = useState(null);
  const [editingSwimmer, setEditingSwimmer] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    rosterGroup: "",
    location: "",
    memberStatus: "Active",
    search: "",
  });

  // Load data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadSwimmers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listSwimmers(filters);
      setSwimmers(data);
    } catch (e) {
      console.error("Failed to load swimmers:", e);
      toast.error("Failed to load swimmers");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Load swimmers when filters change
  useEffect(() => {
    loadSwimmers();
  }, [loadSwimmers]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [groupsData, locationsData] = await Promise.all([
        listRosterGroups(),
        listLocations(),
      ]);
      setRosterGroups(groupsData);
      setLocations(locationsData);
    } catch (e) {
      console.error("Failed to load data:", e);
      toast.error("Failed to load roster groups and locations");
    } finally {
      setLoading(false);
    }
  };

  const handleAddSwimmer = () => {
    setEditingSwimmer(null);
    setShowAddForm(true);
    setSelectedSwimmer(null);
  };

  const handleEditSwimmer = (swimmer) => {
    setEditingSwimmer(swimmer);
    setShowAddForm(true);
  };

  const handleFormClose = () => {
    setShowAddForm(false);
    setEditingSwimmer(null);
  };

  const handleFormSuccess = () => {
    loadSwimmers();
    handleFormClose();
  };

  const handleDeleteSwimmer = async (swimmerId, swimmerName) => {
    if (
      !window.confirm(
        `Are you sure you want to delete ${swimmerName}? This will mark them as inactive.`
      )
    ) {
      return;
    }

    try {
      await deleteSwimmer(swimmerId);
      toast.success("Swimmer deleted successfully!");
      if (selectedSwimmer?._id === swimmerId) {
        setSelectedSwimmer(null);
      }
      loadSwimmers();
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to delete swimmer");
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleSearchChange = (e) => {
    const { value } = e.target;
    setFilters((prev) => ({ ...prev, search: value }));
  };

  return (
    <div className="swimmer-roster-page">
      <div className="app-container">
        <div className="roster-header">
          <div>
            <h1 className="header">Swimmer Roster</h1>
            <p className="subtitle">
              {swimmers.length} swimmer{swimmers.length !== 1 ? "s" : ""} found
            </p>
          </div>
          <div className="header-actions">
            <button className="btn-primary" onClick={handleAddSwimmer}>
              ➕ Add Swimmer
            </button>
            <button
              className="btn-secondary"
              onClick={() => setShowGroupManager(true)}
            >
              ⚙️ Manage Groups
            </button>
          </div>
        </div>

        {/* Filters Section */}
        <div className="filters-section">
          <div className="filter-group">
            <label htmlFor="search">Search by Name</label>
            <input
              id="search"
              type="text"
              placeholder="First, last, or preferred name..."
              value={filters.search}
              onChange={handleSearchChange}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="memberStatus">Status</label>
            <select
              id="memberStatus"
              name="memberStatus"
              value={filters.memberStatus}
              onChange={handleFilterChange}
              className="filter-select"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="rosterGroup">Roster Group</label>
            <select
              id="rosterGroup"
              name="rosterGroup"
              value={filters.rosterGroup}
              onChange={handleFilterChange}
              className="filter-select"
            >
              <option value="">All Groups</option>
              {rosterGroups.map((group) => (
                <option key={group._id} value={group._id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="location">Location</label>
            <select
              id="location"
              name="location"
              value={filters.location}
              onChange={handleFilterChange}
              className="filter-select"
            >
              <option value="">All Locations</option>
              {locations.map((loc) => (
                <option key={loc._id} value={loc._id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="roster-content">
          {/* Swimmers List */}
          <div className="swimmers-section">
            {loading ? (
              <p className="loading-message">Loading swimmers...</p>
            ) : swimmers.length === 0 ? (
              <p className="empty-message">
                No swimmers found. {!filters.search && !filters.rosterGroup && !filters.location && "Add one to get started!"}
              </p>
            ) : (
              <div className="swimmers-table">
                <div className="table-header">
                  <div className="col-initials"></div>
                  <div className="col-name">Name</div>
                  <div className="col-age">Age</div>
                  <div className="col-group">Roster Group</div>
                  <div className="col-status">Status</div>
                  <div className="col-actions">Actions</div>
                </div>

                <div className="table-body">
                  {swimmers.map((swimmer) => (
                    <div
                      key={swimmer._id}
                      className="table-row"
                      onClick={() => setSelectedSwimmer(swimmer)}
                    >
                      <div className="col-initials">
                        <div className="avatar">
                          {swimmer.firstName.charAt(0)}
                          {swimmer.lastName.charAt(0)}
                        </div>
                      </div>
                      <div className="col-name">
                        <div className="swimmer-name">
                          {swimmer.preferredName || `${swimmer.firstName} ${swimmer.lastName}`}
                        </div>
                        <div className="swimmer-meta">
                          {swimmer.dateOfBirth &&
                            `DOB: ${new Date(swimmer.dateOfBirth).toLocaleDateString()}`}
                        </div>
                      </div>
                      <div className="col-age">
                        {swimmer.dateOfBirth && calculateAge(swimmer.dateOfBirth)}
                      </div>
                      <div className="col-group">
                        {swimmer.rosterGroup?.name || "—"}
                      </div>
                      <div className="col-status">
                        <span className={`status-badge status-${swimmer.memberStatus.toLowerCase()}`}>
                          {swimmer.memberStatus}
                        </span>
                      </div>
                      <div className="col-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn-action btn-edit"
                          onClick={() => handleEditSwimmer(swimmer)}
                          title="Edit swimmer"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn-action btn-delete"
                          onClick={() =>
                            handleDeleteSwimmer(
                              swimmer._id,
                              `${swimmer.firstName} ${swimmer.lastName}`
                            )
                          }
                          title="Delete swimmer"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Swimmer Detail View */}
          {selectedSwimmer && (
            <SwimmerDetailView
              swimmer={selectedSwimmer}
              rosterGroups={rosterGroups}
              locations={locations}
              onEdit={handleEditSwimmer}
              onDelete={handleDeleteSwimmer}
              onClose={() => setSelectedSwimmer(null)}
              onUpdate={() => {
                loadSwimmers();
                setSelectedSwimmer(null);
              }}
            />
          )}
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <SwimmerForm
          swimmer={editingSwimmer}
          rosterGroups={rosterGroups}
          locations={locations}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Roster Group Manager Modal */}
      {showGroupManager && (
        <RosterGroupManager
          onClose={() => setShowGroupManager(false)}
          onSuccess={() => {
            loadAllData();
            setShowGroupManager(false);
          }}
        />
      )}
    </div>
  );
}

export default SwimmerRoster;
