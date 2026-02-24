# Swim Team App - Deployment Guide

This guide covers deploying the Swim Team App with the backend on Render and the frontend on Vercel.

## Project Structure

```
swim-team-app/
├── server/                 # Express backend (deploys to Render)
│   ├── package.json
│   ├── .env.example
│   ├── index.js
│   └── ... (other backend files)
├── src/                    # React frontend (deploys to Vercel)
│   ├── config.js          # API URL configuration
│   └── ... (other frontend files)
├── package.json           # Root package (frontend scripts)
├── .env                   # Local development env vars
├── .env.example           # Environment variables template
└── .env.production        # Production frontend env vars
```

## Prerequisites

- MongoDB Atlas account with connection string
- Render account (render.com)
- Vercel account (vercel.com)
- GitHub repository with the code pushed

## Backend Deployment (Render)

### Step 1: Prepare Backend Environment

1. Create a new service on Render
2. Connect your GitHub repository
3. Configure the service:

   **Basic Settings:**
   - Name: `swim-team-app-backend`
   - Environment: `Node`
   - Region: Choose closest to your users
   - Root Directory: `server`

   **Build & Deploy:**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: Standard (or higher for production)

### Step 2: Set Environment Variables on Render

Add these environment variables in the Render dashboard:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/swim_team
JWT_SECRET=your-secure-jwt-secret-key-here
ADMIN_KEY=your-secure-admin-key-here
FRONTEND_URL=https://your-vercel-app.vercel.app
NODE_ENV=production
PORT=5000
```

**Important:** Generate strong secrets for JWT_SECRET and ADMIN_KEY in production.

### Step 3: Deploy

- Render will automatically deploy when you push to GitHub
- Check deployment status in the Render dashboard
- Note the backend URL (e.g., `https://swim-team-app-backend.onrender.com`)

## Frontend Deployment (Vercel)

### Step 1: Prepare Frontend Environment

Update `.env.production` with your Render backend URL:

```
REACT_APP_API_URL=https://swim-team-app-backend.onrender.com
REACT_APP_ADMIN_KEY=your-admin-key
REACT_APP_DEV_USER_ID=
```

### Step 2: Deploy to Vercel

1. Go to vercel.com and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure the project:

   **Framework Preset:** Create React App

   **Build Settings:**
   - Framework: Create React App
   - Build Command: `npm run build`
   - Output Directory: `build`
   - Install Command: `npm install`
   - Root Directory: `./` (project root)

   **Environment Variables:**
   - Add `REACT_APP_API_URL` with your Render backend URL
   - Add `REACT_APP_ADMIN_KEY`
   - Leave `REACT_APP_DEV_USER_ID` empty

5. Click "Deploy"

### Step 3: Verify Deployment

- Check deployment status in Vercel dashboard
- Note the frontend URL (e.g., `https://swim-team-app.vercel.app`)
- Update Render's `FRONTEND_URL` environment variable with this URL

## Local Development

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   cd server && npm install && cd ..
   ```

3. Create `.env` file in root:
   ```
   REACT_APP_API_URL=http://localhost:5000
   REACT_APP_ADMIN_KEY=your-admin-key
   REACT_APP_DEV_USER_ID=your-username
   ```

4. Create `server/.env` file:
   ```
   MONGODB_URI=mongodb://localhost:27017/swim_team
   PORT=5000
   JWT_SECRET=your-jwt-secret
   ADMIN_KEY=your-admin-key
   FRONTEND_URL=http://localhost:3000
   NODE_ENV=development
   ```

### Running Locally

Start both frontend and backend with:
```bash
npm run dev
```

This runs:
- Frontend on `http://localhost:3000`
- Backend on `http://localhost:5000`

Or run separately:
```bash
npm start                 # Frontend only (port 3000)
npm run server           # Backend only (port 5000)
```

## Environment Variables Reference

### Frontend (.env and .env.production)

| Variable | Description | Example |
|----------|-------------|---------|
| `REACT_APP_API_URL` | Backend API base URL | `http://localhost:5000` or `https://...onrender.com` |
| `REACT_APP_ADMIN_KEY` | Admin API key | `your-secure-key` |
| `REACT_APP_DEV_USER_ID` | Default user ID (dev only) | `kyle` or empty for production |

### Backend (server/.env)

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/swim_team` |
| `PORT` | Server port | `5000` |
| `JWT_SECRET` | JWT token secret | `your-secure-secret` |
| `ADMIN_KEY` | Admin authentication key | `your-secure-key` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` or `https://...vercel.app` |
| `NODE_ENV` | Environment | `development` or `production` |

## Troubleshooting

### CORS Errors
- Ensure `FRONTEND_URL` is set correctly on Render
- Check that the frontend URL matches exactly (including protocol)
- Clear browser cache and try again

### Database Connection Errors
- Verify MongoDB Atlas connection string
- Check network access: whitelist Render's IP in MongoDB Atlas
- Test connection locally first

### API Not Responding
- Check Render deployment status
- Verify environment variables are set correctly
- Check Render logs for errors

### Frontend Not Loading Data
- Open browser DevTools Network tab
- Check if API calls are being made
- Verify `REACT_APP_API_URL` is correct
- Check backend logs on Render

## Updating Deployments

### Update Frontend
- Push to GitHub `main` branch
- Vercel will automatically rebuild and deploy

### Update Backend
- Push to GitHub `main` branch
- Render will automatically rebuild and deploy

## Backup & Database Management

### Backup Local Database
```bash
mongodb-tools/bin/mongodump --db swim_team --out ./backup
```

### Restore to MongoDB Atlas
```bash
mongodb-tools/bin/mongorestore --uri "mongodb+srv://user:pass@cluster.mongodb.net/swim_team" ./backup/swim_team
```

## Production Checklist

- [ ] Environment variables set on both Render and Vercel
- [ ] MongoDB Atlas user with correct permissions
- [ ] Strong JWT_SECRET and ADMIN_KEY generated
- [ ] CORS properly configured (FRONTEND_URL set)
- [ ] Frontend and backend URLs match in both deployments
- [ ] Database backed up
- [ ] Test login functionality
- [ ] Test API endpoints
- [ ] Check browser console for errors
- [ ] Verify email notifications (if applicable)

## Support

For issues or questions, check:
- Render logs: Dashboard → Logs
- Vercel logs: Dashboard → Deployments → Logs
- Browser console for frontend errors
- Server logs in Render for backend errors
