import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  listRosterGroups,
  createRosterGroup,
  updateRosterGroup,
  deleteRosterGroup,
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
} from "../api/swimmers";
import "./RosterGroupManager.css";

function RosterGroupManager({ onClose, onSuccess }) {
  const [groups, setGroups] = useState([]);
  const [locations, setLocations] = useState([]);
  const [activeTab, setActiveTab] = useState("groups");
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [groupForm, setGroupForm] = useState({
    name: "",
    description: "",
    displayOrder: 0,
    color: "#3b82f6",
  });

  const [locationForm, setLocationForm] = useState({
    name: "",
    address: "",
    poolType: "SCY",
    description: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupsData, locationsData] = await Promise.all([
        listRosterGroups(),
        listLocations(),
      ]);
      setGroups(groupsData);
      setLocations(locationsData);
    } catch (e) {
      console.error("Failed to load data:", e);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // ========== ROSTER GROUPS ==========

  const handleGroupFormChange = (e) => {
    const { name, value } = e.target;
    setGroupForm((prev) => ({
      ...prev,
      [name]: name === "displayOrder" ? parseInt(value, 10) : value,
    }));
  };

  const handleGroupSubmit = async (e) => {
    e.preventDefault();

    if (!groupForm.name) {
      toast.error("Group name is required");
      return;
    }

    try {
      setSaving(true);

      if (editingGroup) {
        await updateRosterGroup(editingGroup._id, groupForm);
        toast.success("Group updated!");
      } else {
        await createRosterGroup(groupForm);
        toast.success("Group created!");
      }

      setGroupForm({
        name: "",
        description: "",
        displayOrder: 0,
        color: "#3b82f6",
      });
      setEditingGroup(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to save group");
    } finally {
      setSaving(false);
    }
  };

  const handleEditGroup = (group) => {
    setEditingGroup(group);
    setGroupForm({
      name: group.name,
      description: group.description || "",
      displayOrder: group.displayOrder || 0,
      color: group.color || "#3b82f6",
    });
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm("Delete this group?")) {
      return;
    }

    try {
      await deleteRosterGroup(groupId);
      toast.success("Group deleted!");
      loadData();
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to delete group");
    }
  };

  // ========== LOCATIONS ==========

  const handleLocationFormChange = (e) => {
    const { name, value } = e.target;
    setLocationForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLocationSubmit = async (e) => {
    e.preventDefault();

    if (!locationForm.name) {
      toast.error("Location name is required");
      return;
    }

    try {
      setSaving(true);

      if (editingLocation) {
        await updateLocation(editingLocation._id, locationForm);
        toast.success("Location updated!");
      } else {
        await createLocation(locationForm);
        toast.success("Location created!");
      }

      setLocationForm({
        name: "",
        address: "",
        poolType: "SCY",
        description: "",
      });
      setEditingLocation(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to save location");
    } finally {
      setSaving(false);
    }
  };

  const handleEditLocation = (location) => {
    setEditingLocation(location);
    setLocationForm({
      name: location.name,
      address: location.address || "",
      poolType: location.poolType || "SCY",
      description: location.description || "",
    });
  };

  const handleDeleteLocation = async (locationId) => {
    if (!window.confirm("Delete this location?")) {
      return;
    }

    try {
      await deleteLocation(locationId);
      toast.success("Location deleted!");
      loadData();
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to delete location");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content roster-group-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manage Rosters & Locations</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={`tab ${activeTab === "groups" ? "active" : ""}`}
            onClick={() => setActiveTab("groups")}
          >
            Roster Groups
          </button>
          <button
            className={`tab ${activeTab === "locations" ? "active" : ""}`}
            onClick={() => setActiveTab("locations")}
          >
            Locations
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <p className="loading-message">Loading...</p>
          ) : activeTab === "groups" ? (
            <div className="tab-content">
              <div className="form-section">
                <h3>{editingGroup ? "Edit Group" : "Add New Group"}</h3>
                <form onSubmit={handleGroupSubmit} className="manager-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="group_name">Group Name *</label>
                      <input
                        type="text"
                        id="group_name"
                        name="name"
                        value={groupForm.name}
                        onChange={handleGroupFormChange}
                        placeholder="e.g. Senior, Junior, Age Group"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="group_order">Display Order</label>
                      <input
                        type="number"
                        id="group_order"
                        name="displayOrder"
                        value={groupForm.displayOrder}
                        onChange={handleGroupFormChange}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="group_color">Color</label>
                      <input
                        type="color"
                        id="group_color"
                        name="color"
                        value={groupForm.color}
                        onChange={handleGroupFormChange}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="group_desc">Description</label>
                    <textarea
                      id="group_desc"
                      name="description"
                      value={groupForm.description}
                      onChange={handleGroupFormChange}
                      placeholder="Optional description..."
                      rows="2"
                    />
                  </div>

                  <div className="form-actions">
                    {editingGroup && (
                      <button
                        type="button"
                        className="btn-cancel"
                        onClick={() => {
                          setEditingGroup(null);
                          setGroupForm({
                            name: "",
                            description: "",
                            displayOrder: 0,
                            color: "#3b82f6",
                          });
                        }}
                      >
                        Cancel Edit
                      </button>
                    )}
                    <button type="submit" className="btn-submit" disabled={saving}>
                      {saving ? "Saving..." : editingGroup ? "Update Group" : "Create Group"}
                    </button>
                  </div>
                </form>
              </div>

              <div className="list-section">
                <h3>Existing Groups</h3>
                {groups.length === 0 ? (
                  <p className="empty-message">No groups yet.</p>
                ) : (
                  <div className="item-list">
                    {groups.map((group) => (
                      <div key={group._id} className="item-row">
                        <div className="item-info">
                          <div className="item-main">
                            <span
                              className="color-dot"
                              style={{ backgroundColor: group.color }}
                            ></span>
                            <span className="item-name">{group.name}</span>
                          </div>
                          {group.description && (
                            <div className="item-desc">{group.description}</div>
                          )}
                        </div>
                        <div className="item-actions">
                          <button
                            className="btn-action btn-edit"
                            onClick={() => handleEditGroup(group)}
                          >
                            ✏️
                          </button>
                          <button
                            className="btn-action btn-delete"
                            onClick={() => handleDeleteGroup(group._id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="tab-content">
              <div className="form-section">
                <h3>{editingLocation ? "Edit Location" : "Add New Location"}</h3>
                <form onSubmit={handleLocationSubmit} className="manager-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="location_name">Location Name *</label>
                      <input
                        type="text"
                        id="location_name"
                        name="name"
                        value={locationForm.name}
                        onChange={handleLocationFormChange}
                        placeholder="e.g. Main Pool, East Facility"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="location_pool">Pool Type</label>
                      <select
                        id="location_pool"
                        name="poolType"
                        value={locationForm.poolType}
                        onChange={handleLocationFormChange}
                      >
                        <option value="25Y">25Y (Short Course Yards)</option>
                        <option value="25M">25M (Short Course Meters)</option>
                        <option value="50M">50M (Long Course Meters)</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="location_address">Address</label>
                    <input
                      type="text"
                      id="location_address"
                      name="address"
                      value={locationForm.address}
                      onChange={handleLocationFormChange}
                      placeholder="Street address..."
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="location_desc">Description</label>
                    <textarea
                      id="location_desc"
                      name="description"
                      value={locationForm.description}
                      onChange={handleLocationFormChange}
                      placeholder="Optional description..."
                      rows="2"
                    />
                  </div>

                  <div className="form-actions">
                    {editingLocation && (
                      <button
                        type="button"
                        className="btn-cancel"
                        onClick={() => {
                          setEditingLocation(null);
                          setLocationForm({
                            name: "",
                            address: "",
                            poolType: "SCY",
                            description: "",
                          });
                        }}
                      >
                        Cancel Edit
                      </button>
                    )}
                    <button type="submit" className="btn-submit" disabled={saving}>
                      {saving ? "Saving..." : editingLocation ? "Update Location" : "Create Location"}
                    </button>
                  </div>
                </form>
              </div>

              <div className="list-section">
                <h3>Existing Locations</h3>
                {locations.length === 0 ? (
                  <p className="empty-message">No locations yet.</p>
                ) : (
                  <div className="item-list">
                    {locations.map((location) => (
                      <div key={location._id} className="item-row">
                        <div className="item-info">
                          <div className="item-main">{location.name}</div>
                          {location.address && (
                            <div className="item-desc">{location.address}</div>
                          )}
                          {location.poolType && (
                            <div className="item-meta">{location.poolType}</div>
                          )}
                        </div>
                        <div className="item-actions">
                          <button
                            className="btn-action btn-edit"
                            onClick={() => handleEditLocation(location)}
                          >
                            ✏️
                          </button>
                          <button
                            className="btn-action btn-delete"
                            onClick={() => handleDeleteLocation(location._id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default RosterGroupManager;
