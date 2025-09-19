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
│   ├── pages/             # Screens (PracticeBuilder, PracticeLibrary)
│   ├── components/        # Shared UI
│   ├── api/               # API wrappers
│   └── utils/             # Yardage/time parsing
└── package.json
```

---

## ⚙️ Setup

### 1. Clone Repo
```bash
git clone https://github.com/kdesrosiers/swim-team-app.git
cd swim-team-app
```

### 2. Install Dependencies
Frontend:
```bash
npm install
```

Backend (inside `/server`):
```bash
cd server
npm install
```

### 3. Environment
Create a `.env` file in `/server`:
```
MONGODB_URI=mongodb://localhost:27017/swimteam
ADMIN_KEY=your_secret_key
EXPORT_DIR=C:/Users/<YourUser>/Desktop/practices
```

### 4. Run
Backend (from `/server`):
```bash
node index.js
```

Frontend (from root):
```bash
npm start
```

---

## 📖 Usage
1. Open `http://localhost:3000` for frontend
2. Use the Practice Builder to create/edit practices
3. Save to DB or export to Word
4. Browse saved practices in the Practice Library

---

## ✅ Next Steps
- User authentication
- Meet lineup management
- Swimmer best times tracking
- AI-assisted set generation

---
