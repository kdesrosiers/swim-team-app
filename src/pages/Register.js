import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { post } from "../api/client";
import "./Register.css";

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    username: "",
    password: "",
    confirmPassword: "",
    teamName: "",
    teamAbbreviation: "",
    exportDirectory: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const requestBody = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        username: formData.username,
        password: formData.password,
      };

      // Add phone if provided
      if (formData.phone) {
        requestBody.phone = formData.phone;
      }

      // Add address if provided
      if (formData.address) {
        requestBody.address = formData.address;
      }

      // Add swim team if provided
      if (formData.teamName) {
        requestBody.swimTeam = {
          name: formData.teamName,
          abbreviation: formData.teamAbbreviation || "",
        };
      }

      // Add export directory if provided
      if (formData.exportDirectory) {
        requestBody.exportDirectory = formData.exportDirectory;
      }

      const data = await post("/api/auth/register", requestBody);

      // Store token and user info
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      toast.success(`Welcome, ${data.user.firstName}!`);
      navigate("/home");
    } catch (error) {
      console.error("Registration error:", error);
      toast.error(error.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-container">
        <div className="register-card">
          <div className="register-header">
            <h1>Create Account</h1>
            <p>Join Swim Team App today</p>
          </div>

          <form onSubmit={handleSubmit} className="register-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName">First Name *</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  placeholder="John"
                  autoComplete="given-name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="lastName">Last Name *</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  placeholder="Doe"
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="john.doe@example.com"
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(123) 456-7890"
                  autoComplete="tel"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="address">Address</label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="e.g., 123 Main St, Anytown, ST 12345"
                autoComplete="street-address"
              />
            </div>

            <div className="form-group">
              <label htmlFor="username">Username *</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                placeholder="johndoe"
                autoComplete="username"
                minLength="3"
                maxLength="50"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="password">Password *</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  minLength="8"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password *</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  placeholder="Confirm password"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="form-divider">
              <span>Swim Team Information (Optional)</span>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="teamName">Team Name</label>
                <input
                  type="text"
                  id="teamName"
                  name="teamName"
                  value={formData.teamName}
                  onChange={handleChange}
                  placeholder="e.g., Ocean Waves SC"
                />
              </div>

              <div className="form-group">
                <label htmlFor="teamAbbreviation">Abbreviation</label>
                <input
                  type="text"
                  id="teamAbbreviation"
                  name="teamAbbreviation"
                  value={formData.teamAbbreviation}
                  onChange={handleChange}
                  placeholder="e.g., OWSC"
                  maxLength="10"
                />
              </div>
            </div>

            <div className="form-divider">
              <span>Practice Export Settings (Optional)</span>
            </div>

            <div className="form-group">
              <label htmlFor="exportDirectory">Export Directory</label>
              <input
                type="text"
                id="exportDirectory"
                name="exportDirectory"
                value={formData.exportDirectory}
                onChange={handleChange}
                placeholder="e.g., C:\\Users\\YourName\\Desktop\\Practices"
              />
              <small>Where practice files will be saved when you export</small>
            </div>

            <button type="submit" className="register-btn" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="register-footer">
            <p>
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
