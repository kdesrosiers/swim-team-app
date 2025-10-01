# Swim Team App

A web application for building, saving, exporting, and organizing swim team practices.  
This project is built with **React** (frontend) and **Node.js + Express + MongoDB** (backend).  
It is currently in active development.

---

## Features (Current)

### Practice Builder
- Create structured practices with sections (Warm Up, Pre-Set, Main Set, Cool Down, Breaks).
- Drag-and-drop reordering of sections.
- Live yardage and time calculation:
  - Parses sets like `3x100 Free @ 1:30`.
  - Handles nested repeat blocks (`3x { 4x50 Free @ :50 }`).
- Start time tracking → displays rolling section end times.
- Practice metadata:
  - Date picker
  - Roster group selection (from config)
  - Pool type dropdown (**SCM, SCY, LCM**)
- Export practices to formatted **Word documents** (`.docx`) with:
  - Titles
  - Totals (yardage, time)
  - Section formatting
  - Aligned end times
- Save practices to MongoDB.
- New **Save & Export** button (save to DB *and* generate `.docx` at once).

### Practice Library
- ChatGPT-style layout:
  - Sidebar with roster groups (from config).
  - Center pane: practice list (ordered by date).
  - Right pane: live preview of selected practice.
- Search bar for filtering practices by text/title.
- Pagination with “Prev / Next”.
- Uses the same preview formatting as Practice Builder.

### Config File (`server/config/roster.config.json`)
Centralized config for:
- **Roster groups**
- **Default warmups** (auto-loads when selecting a roster in Practice Builder).
- **Practice schedule** (days/times per roster).
- **Default roster** (used when Practice Builder first loads).

Example structure:

```json
{
  "defaultRoster": "Gold/Platinum",
  "rosters": ["Yellow", "Blue", "White", "Bronze", "Silver", "Gold/Platinum"],
  "warmups": {
    "Yellow": "400 swim\n4 x 100 K/S/D/S @ 2:00\n4 x 50 build @ :50",
    "Blue": "300 swim\n..."
  },
  "practiceSchedule": {
    "Gold/Platinum": {
      "Mon": "18:30",
      "Tue": "19:00",
      "Wed": "18:30",
      "Thu": "19:00",
      "Fri": "OFF",
      "Sat": "OFF",
      "Sun": "06:30"
    }
  }
}

---

## Development Setup

### Prerequisites
- Node.js (v16+)
- MongoDB running locally on port 27017

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env` (root for frontend)
   - Copy `server/.env.example` to `server/.env` (for backend)
   - Update values as needed (especially `ADMIN_KEY` and `EXPORT_DIR`)

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

