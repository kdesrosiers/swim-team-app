# Swim Team App

A web application for managing swim team practices, rosters, and training libraries.
Built with **React** (frontend) and **Node.js/Express + MongoDB** (backend).

---

## 🚀 Features

### Practice Builder
- Drag-and-drop interface for building practices
- Section types: Warmup, Main Set, Break, etc.
- Live yardage and time calculation
- Start time and per-section clock tracking
- Export practices to **Word (.docx)** with formatted output
- Save practices to MongoDB with:
  - Date
  - Roster
  - Pool type (SCM, SCY, LCM)
  - Sections with yardage/time totals
- Config-driven defaults:
  - Default roster
  - Default warmups per roster
  - Practice schedules per roster

### Practice Library
- Sidebar navigation by roster (ChatGPT-style UI)
- List of saved practices ordered by date
- Search by title or text
- Preview panel reusing the Practice Builder formatting

### Configuration Maintenance
- Web UI for managing rosters and settings
- Configure default roster
- Set warmups per roster
- Define practice schedules (days/times) per roster
- Real-time save to config file

---

## 🛠️ Tech Stack
- **Frontend**: React, @dnd-kit for drag-and-drop
- **Backend**: Node.js, Express
- **Database**: MongoDB (Mongoose)
- **Docs Export**: docx npm library
- **Config**: JSON file (`server/config/roster.config.json`)

---

## 📂 Project Structure
```
swim-team-app/
├── server/                # Backend
│   ├── config.js          # Load/save/watch config
│   ├── db.js              # MongoDB connection
│   ├── exportDocx.js      # Word export logic
│   ├── index.js           # Express server
│   ├── models.js          # Practice schema
│   └── config/roster.config.json
├── src/                   # Frontend React app
│   ├── pages/             # Screens (PracticeBuilder, PracticeLibrary, ConfigMaintenance)
│   ├── components/        # Shared UI
│   ├── api/               # API wrappers
│   └── utils/             # Yardage/time parsing
└── package.json
```

---

## ⚙️ Development Setup

### Prerequisites
- Node.js (v16+)
- MongoDB running locally on port 27017

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/kdesrosiers/swim-team-app.git
   cd swim-team-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env` (root for frontend)
   - Copy `server/.env.example` to `server/.env` (for backend)
   - Update values as needed (especially `ADMIN_KEY` and `EXPORT_DIR`)

   Example `server/.env`:
   ```
   MONGODB_URI=mongodb://localhost:27017/swimteam
   ADMIN_KEY=your_secret_key
   EXPORT_DIR=C:/Users/<YourUser>/Desktop/practices
   ```

4. Start MongoDB:
   ```bash
   # macOS/Linux
   mongod

   # Windows
   # MongoDB should start as a service automatically
   ```

### Running the App

**Development mode (runs both frontend + backend):**
```bash
npm run dev
```
This starts:
- React frontend on http://localhost:3000
- Express API on http://localhost:5174

**Run servers separately:**
```bash
# Frontend only
npm start

# Backend only (with auto-restart)
npm run server

# Backend only (production)
npm run server:prod
```

**Build for production:**
```bash
npm run build
```

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start React frontend only (port 3000) |
| `npm run server` | Start backend with nodemon (auto-restart on changes) |
| `npm run server:prod` | Start backend without auto-restart |
| `npm run dev` | **Start both frontend and backend concurrently** |
| `npm run build` | Build React app for production |
| `npm test` | Run tests |

---

## 📖 Usage
1. Open `http://localhost:3000` for frontend
2. Use the Practice Builder to create/edit practices
3. Save to DB or export to Word
4. Browse saved practices in the Practice Library
5. Manage rosters and settings in Configuration

---

## ✅ Next Steps
- User authentication
- Meet lineup management
- Swimmer best times tracking
- AI-assisted set generation

---
