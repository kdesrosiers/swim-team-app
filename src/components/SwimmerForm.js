import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  createSwimmer,
  updateSwimmer,
  generateUSASwimmingId,
  calculateAge,
} from "../api/swimmers";
import "./SwimmerForm.css";

function SwimmerForm({ swimmer, rosters, locations, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    preferredName: "",
    dateOfBirth: "",
    gender: "Male",
    usaSwimmingId: "",
    customSwimmerId: "",
    rosterGroup: "",
    location: "",
    memberStatus: "Active",
    email: "",
    phone: "",
    emergencyContact: {
      name: "",
      phone: "",
      relationship: "",
    },
    medicalNotes: "",
    insurance: {
      provider: "",
      policyNumber: "",
    },
    racingStartCertified: false,
    swimsuitSize: "",
    joinDate: "",
    notes: "",
  });

  const [section, setSection] = useState("basic");
  const [saving, setSaving] = useState(false);
  const [age, setAge] = useState(null);

  useEffect(() => {
    if (swimmer) {
      setFormData({
        firstName: swimmer.firstName || "",
        lastName: swimmer.lastName || "",
        middleName: swimmer.middleName || "",
        preferredName: swimmer.preferredName || "",
        dateOfBirth: swimmer.dateOfBirth
          ? new Date(swimmer.dateOfBirth).toISOString().split("T")[0]
          : "",
        gender: swimmer.gender || "Male",
        usaSwimmingId: swimmer.usaSwimmingId || "",
        customSwimmerId: swimmer.customSwimmerId || "",
        rosterGroup: swimmer.rosterGroup?._id || "",
        location: swimmer.location?._id || "",
        memberStatus: swimmer.memberStatus || "Active",
        email: swimmer.email || "",
        phone: swimmer.phone || "",
        emergencyContact: {
          name: swimmer.emergencyContact?.name || "",
          phone: swimmer.emergencyContact?.phone || "",
          relationship: swimmer.emergencyContact?.relationship || "",
        },
        medicalNotes: swimmer.medicalNotes || "",
        insurance: {
          provider: swimmer.insurance?.provider || "",
          policyNumber: swimmer.insurance?.policyNumber || "",
        },
        racingStartCertified: swimmer.racingStartCertified || false,
        swimsuitSize: swimmer.swimsuitSize || "",
        joinDate: swimmer.joinDate
          ? new Date(swimmer.joinDate).toISOString().split("T")[0]
          : "",
        notes: swimmer.notes || "",
      });

      if (swimmer.dateOfBirth) {
        setAge(calculateAge(swimmer.dateOfBirth));
      }
    }
  }, [swimmer]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const finalValue = type === "checkbox" ? checked : value;

    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setFormData((prev) => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: finalValue },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: finalValue,
      }));

      // Update age when DOB changes
      if (name === "dateOfBirth" && value) {
        setAge(calculateAge(value));
      }
    }
  };

  const generateUSAId = () => {
    if (!formData.firstName || !formData.lastName || !formData.dateOfBirth) {
      toast.error("First name, last name, and date of birth are required");
      return;
    }

    const id = generateUSASwimmingId(
      formData.firstName,
      formData.lastName,
      formData.middleName,
      formData.dateOfBirth
    );

    setFormData((prev) => ({ ...prev, usaSwimmingId: id }));
    toast.success("USA Swimming ID generated!");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.firstName || !formData.lastName) {
      toast.error("First name and last name are required");
      return;
    }

    if (!formData.dateOfBirth) {
      toast.error("Date of birth is required");
      return;
    }

    if (!formData.gender) {
      toast.error("Gender is required");
      return;
    }

    if (!formData.rosterGroup) {
      toast.error("Roster group is required");
      return;
    }

    try {
      setSaving(true);

      if (swimmer) {
        // Update existing
        await updateSwimmer(swimmer._id, formData);
        toast.success("Swimmer updated successfully!");
      } else {
        // Create new
        await createSwimmer(formData);
        toast.success("Swimmer created successfully!");
      }

      onSuccess();
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to save swimmer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content swimmer-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{swimmer ? "Edit Swimmer" : "Add New Swimmer"}</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Section Tabs */}
        <div className="form-tabs">
          <button
            className={`tab ${section === "basic" ? "active" : ""}`}
            onClick={() => setSection("basic")}
          >
            Basic Info
          </button>
          <button
            className={`tab ${section === "contact" ? "active" : ""}`}
            onClick={() => setSection("contact")}
          >
            Contact
          </button>
          <button
            className={`tab ${section === "medical" ? "active" : ""}`}
            onClick={() => setSection("medical")}
          >
            Medical
          </button>
          <button
            className={`tab ${section === "swimming" ? "active" : ""}`}
            onClick={() => setSection("swimming")}
          >
            Swimming
          </button>
        </div>

        <form onSubmit={handleSubmit} className="swimmer-form">
          {/* Basic Information Section */}
          {section === "basic" && (
            <div className="form-section">
              <h3>Basic Information</h3>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name *</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="e.g. John"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="lastName">Last Name *</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="e.g. Smith"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="middleName">Middle Name</label>
                  <input
                    type="text"
                    id="middleName"
                    name="middleName"
                    value={formData.middleName}
                    onChange={handleInputChange}
                    placeholder="e.g. Michael"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="preferredName">Preferred Name</label>
                  <input
                    type="text"
                    id="preferredName"
                    name="preferredName"
                    value={formData.preferredName}
                    onChange={handleInputChange}
                    placeholder="Display name if different"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="dateOfBirth">Date of Birth *</label>
                  <input
                    type="date"
                    id="dateOfBirth"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    required
                  />
                  {age !== null && <p className="form-hint">Age: {age}</p>}
                </div>

                <div className="form-group">
                  <label htmlFor="gender">Gender *</label>
                  <select
                    id="gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-section-divider"></div>

              <h3>Identification</h3>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="usaSwimmingId">USA Swimming ID</label>
                  <div className="input-with-button">
                    <input
                      type="text"
                      id="usaSwimmingId"
                      name="usaSwimmingId"
                      value={formData.usaSwimmingId}
                      onChange={handleInputChange}
                      placeholder="e.g. SMITH J X 01011995"
                    />
                    <button
                      type="button"
                      className="btn-generate"
                      onClick={generateUSAId}
                      title="Auto-generate USA Swimming ID"
                    >
                      🎯
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="customSwimmerId">Custom Swimmer ID</label>
                  <input
                    type="text"
                    id="customSwimmerId"
                    name="customSwimmerId"
                    value={formData.customSwimmerId}
                    onChange={handleInputChange}
                    placeholder="Team-defined ID"
                  />
                </div>
              </div>

              <div className="form-section-divider"></div>

              <h3>Organization</h3>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="rosterGroup">Roster Group *</label>
                  <select
                    id="rosterGroup"
                    name="rosterGroup"
                    value={formData.rosterGroup}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select a group</option>
                    {rosters.map((roster) => (
                      <option key={roster} value={roster}>
                        {roster}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="location">Location</label>
                  <select
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                  >
                    <option value="">Select a location</option>
                    {locations.map((loc) => (
                      <option key={loc._id} value={loc._id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="memberStatus">Member Status</label>
                  <select
                    id="memberStatus"
                    name="memberStatus"
                    value={formData.memberStatus}
                    onChange={handleInputChange}
                  >
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Contact Information Section */}
          {section === "contact" && (
            <div className="form-section">
              <h3>Contact Information</h3>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="swimmer@example.com"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="phone">Phone</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div className="form-section-divider"></div>

              <h3>Emergency Contact</h3>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="emergency_name">Emergency Contact Name</label>
                  <input
                    type="text"
                    id="emergency_name"
                    name="emergencyContact.name"
                    value={formData.emergencyContact.name}
                    onChange={handleInputChange}
                    placeholder="Parent or guardian name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="emergency_phone">Emergency Contact Phone</label>
                  <input
                    type="tel"
                    id="emergency_phone"
                    name="emergencyContact.phone"
                    value={formData.emergencyContact.phone}
                    onChange={handleInputChange}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="emergency_relationship">Relationship</label>
                  <input
                    type="text"
                    id="emergency_relationship"
                    name="emergencyContact.relationship"
                    value={formData.emergencyContact.relationship}
                    onChange={handleInputChange}
                    placeholder="e.g. Mother, Father, Guardian"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Medical & Safety Section */}
          {section === "medical" && (
            <div className="form-section">
              <h3>Medical & Safety Information</h3>

              <div className="form-group">
                <label htmlFor="medicalNotes">Medical Notes</label>
                <textarea
                  id="medicalNotes"
                  name="medicalNotes"
                  value={formData.medicalNotes}
                  onChange={handleInputChange}
                  placeholder="Allergies, conditions, medications, etc."
                  rows="4"
                  maxLength="1000"
                />
                <p className="char-count">
                  {formData.medicalNotes.length}/1000
                </p>
              </div>

              <div className="form-section-divider"></div>

              <h3>Insurance</h3>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="insurance_provider">Insurance Provider</label>
                  <input
                    type="text"
                    id="insurance_provider"
                    name="insurance.provider"
                    value={formData.insurance.provider}
                    onChange={handleInputChange}
                    placeholder="e.g. Blue Cross"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="insurance_policy">Policy Number</label>
                  <input
                    type="text"
                    id="insurance_policy"
                    name="insurance.policyNumber"
                    value={formData.insurance.policyNumber}
                    onChange={handleInputChange}
                    placeholder="Policy number"
                  />
                </div>
              </div>

              <div className="form-section-divider"></div>

              <h3>Certification</h3>

              <div className="form-group checkbox">
                <label htmlFor="racingStartCertified">
                  <input
                    type="checkbox"
                    id="racingStartCertified"
                    name="racingStartCertified"
                    checked={formData.racingStartCertified}
                    onChange={handleInputChange}
                  />
                  Racing Start Certified (USA Swimming)
                </label>
              </div>
            </div>
          )}

          {/* Swimming Profile Section */}
          {section === "swimming" && (
            <div className="form-section">
              <h3>Swimming Profile</h3>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="swimsuitSize">Swimsuit Size</label>
                  <input
                    type="text"
                    id="swimsuitSize"
                    name="swimsuitSize"
                    value={formData.swimsuitSize}
                    onChange={handleInputChange}
                    placeholder="e.g. 26, 28, XS, S, M, L"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="joinDate">Join Date</label>
                  <input
                    type="date"
                    id="joinDate"
                    name="joinDate"
                    value={formData.joinDate}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-section-divider"></div>

              <div className="form-group">
                <label htmlFor="notes">Coach Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="General coach notes about the swimmer..."
                  rows="4"
                  maxLength="1000"
                />
                <p className="char-count">
                  {formData.notes.length}/1000
                </p>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={saving}
            >
              {saving ? "Saving..." : swimmer ? "Update Swimmer" : "Create Swimmer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SwimmerForm;
