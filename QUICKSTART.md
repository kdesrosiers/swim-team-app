# Quick Start Guide

## First Time Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment files:**
   ```bash
   # Frontend env
   cp .env.example .env

   # Backend env
   cp server/.env.example server/.env
   ```

3. **Edit your `.env` files:**
   - Set a secure `ADMIN_KEY` (same in both files)
   - Set `DEV_USER_ID` to your username
   - Update `EXPORT_DIR` to your desired export location

4. **Start MongoDB:**
   - macOS/Linux: `mongod`
   - Windows: Usually runs as a service

## Running the App

**Easiest way - Run both frontend + backend:**
```bash
npm run dev
```

Then open:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5174

## Individual Commands

```bash
# Frontend only (React)
npm start

# Backend only (Node/Express)
npm run server

# Backend production mode
npm run server:prod

# Build for production
npm run build
```

## Testing the Setup

1. Navigate to http://localhost:3000
2. Click "Practice Builder"
3. Create a practice
4. Click "💾 Save Practice"
5. Should see a success toast notification
6. Click "Practice Library" to view saved practices

## Troubleshooting

**Port already in use:**
- Frontend (3000): Kill any existing React apps
- Backend (5174): Kill any existing Node processes

**MongoDB connection failed:**
- Ensure MongoDB is running: `mongod`
- Check connection string in `server/.env`

**401 Unauthorized:**
- Ensure `ADMIN_KEY` matches in both `.env` files
- Check `REACT_APP_ADMIN_KEY` is set in root `.env`

**Toast notifications not appearing:**
- Clear browser cache
- Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
