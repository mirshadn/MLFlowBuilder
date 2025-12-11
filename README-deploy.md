# No-Code ML Pipeline Builder - Deployment Guide

## Current Deployment Status

### ✅ Backend (Deployed)
- **Platform**: Render
- **URL**: https://mlflowbuilder-1.onrender.com
- **Status**: Live and running
- **Features**: Binary classification, ML model training, data preprocessing

### 🔄 Frontend (Local Development)
- **Platform**: Next.js running locally
- **URL**: http://localhost:3000
- **Status**: Ready for deployment to Vercel

### 📦 Repository
- **GitHub**: https://github.com/mirshadn/MLFlowBuilder
- **Branch**: main
- **Status**: All code synchronized and up-to-date

## Deployment Files

- `render.yaml` — Render deployment configuration for backend
- `requirements.txt` — Python dependencies for backend
- `Procfile` — Alternative start command for Procfile-based hosts
- `.gitignore` — Ignores virtual environments, node_modules, build artifacts

## Backend Deployment (Already Completed)

The backend is successfully deployed to Render with the following configuration:

```yaml
services:
  - type: web
    name: no-code-ml-backend
    runtime: python3.12
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
```

**API Endpoints Available:**
- `POST /upload` — Upload CSV/Excel datasets
- `GET /target_stats` — Get column statistics
- `POST /train` — Train ML models with binary classification support

## Frontend Deployment (Optional)

To deploy the frontend to Vercel:

1. Sign in to [Vercel](https://vercel.com) and click "New Project"
2. Import from GitHub and select your `MLFlowBuilder` repository
3. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
4. Add Environment Variable:
   - **Name**: `NEXT_PUBLIC_API_BASE`
   - **Value**: `https://mlflowbuilder-1.onrender.com`
5. Click "Deploy"

## Features Implemented

- **Binary Classification**: Select 1 or 2 target columns (solves "target must have at least 2 classes" error)
- **Drag-and-Drop Upload**: Support for CSV and Excel files
- **Real-time Training**: Live model training with progress indicators
- **Multiple Models**: Logistic Regression, Decision Tree, Random Forest, etc.
- **Performance Metrics**: Comprehensive evaluation for classification and regression

## Local Development

To run locally:

```bash
# Backend
python main.py

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

## Environment Variables

- `NEXT_PUBLIC_API_BASE`: Backend API URL (set to Render URL for production)
- `PORT`: Automatically set by Render for backend deployment

## Support

The application is fully functional with:
- ✅ Backend deployed and tested
- ✅ Frontend running locally
- ✅ All features implemented and working
- ✅ Code synchronized with GitHub
