# Changelog

## [Unreleased] - 2025-10-01

### 🔒 Security
- **Fixed**: Added `.env` to `.gitignore` to prevent committing secrets
- **Fixed**: Removed hard-coded user IDs from codebase
- **Changed**: Implemented environment-based user authentication (dev mode)
- **Added**: Environment variable templates (`.env.example`, `server/.env.example`)

### ✨ Features
- **Added**: Toast notifications system using `react-hot-toast`
  - Non-blocking success/error messages
  - Custom styling with dark theme
  - Configurable durations based on message type
- **Added**: Comprehensive MongoDB validation
  - Date format validation (YYYY-MM-DD)
  - Pool type enum (SCY, SCM, LCM)
  - Field length limits and range validation
  - Required field enforcement

### 🏗️ Code Quality
- **Refactored**: Extracted ~240 lines of duplicate code into shared utilities
  - Created `src/utils/timeHelpers.js` (frontend)
  - Created `server/utils/timeHelpers.js` (backend)
  - Removed duplicate functions from PracticeBuilder, PracticePreview, exportDocx
- **Fixed**: Implemented missing helper functions in PracticePreview.jsx
- **Improved**: Better error handling with validation error messages

### 🛠️ Developer Experience
- **Added**: NPM scripts for easier development
  - `npm run dev` - Run both frontend + backend concurrently
  - `npm run server` - Backend with auto-restart (nodemon)
  - `npm run server:prod` - Production backend
- **Added**: Nodemon configuration for file watching
- **Added**: `server/package.json` with ESM module type
- **Added**: `QUICKSTART.md` for new developers
- **Updated**: `README.md` with setup instructions and script documentation

### 📦 Dependencies
- **Added**: `react-hot-toast` (^2.6.0) - Toast notifications
- **Added**: `concurrently` (^9.2.1) - Run multiple npm scripts
- **Added**: `nodemon` (^3.1.10) - Auto-restart server on changes

### 🐛 Bug Fixes
- **Fixed**: Unused variable warnings in PracticeBuilder.js
- **Fixed**: ESM module warnings by adding server/package.json

---

## Summary of Changes

### Files Added (7)
- `.env.example` - Frontend environment template
- `server/.env.example` - Backend environment template
- `src/utils/timeHelpers.js` - Shared time utilities (frontend)
- `server/utils/timeHelpers.js` - Shared time utilities (backend)
- `server/package.json` - Server ESM config
- `nodemon.json` - Nodemon configuration
- `QUICKSTART.md` - Quick start guide
- `CHANGELOG.md` - This file

### Files Modified (9)
- `.gitignore` - Added .env
- `package.json` - Added dev scripts
- `src/App.js` - Added Toaster component
- `src/api/client.js` - Removed hard-coded userId
- `src/pages/PracticeBuilder.js` - Replaced alerts with toasts, imported helpers
- `src/components/PracticePreview.jsx` - Replaced stub functions with imports
- `server/index.js` - Environment-based userId, validation error handling
- `server/models.js` - Comprehensive validation
- `server/exportDocx.js` - Imported shared helpers
- `README.md` - Added development documentation

### Lines of Code Changed
- **Removed**: ~240 lines of duplicate code
- **Added**: ~600 lines (utilities, docs, config)
- **Net Change**: +360 lines (with better organization)
