Deployment guide — quick steps to publish frontend and backend

Overview
- Frontend: Next.js app located in `frontend/` — recommended to deploy to Vercel.
- Backend: FastAPI app `main.py` — recommended to deploy to Render (Python) or any Docker-capable host.

Files added
- `requirements.txt` — backend dependencies
- `Dockerfile` — backend Docker image
- `Procfile` — start command for Procfile-based hosts
- `.gitignore` — ignores venvs, node_modules, build artifacts

Prepare repository
1. Initialize git (if not already):
   ```powershell
   cd 'c:\Users\moham\Downloads\No-Code ML Pipeline Builder'
   git init
   git add .
   git commit -m "Add project with deployment helper files"
   ```

Push to GitHub (create repo under your account `mirshadn`)
1. Create a new repo on GitHub named `No-Code-ML-Pipeline-Builder` (via web UI).
2. Add remote and push (HTTPS):
   ```bash
   git remote add origin https://github.com/mirshadn/No-Code-ML-Pipeline-Builder.git
   git branch -M main
   git push -u origin main
   ```

Frontend (Vercel)
1. Sign in to Vercel and Import Project -> select GitHub repo.
2. Set Framework to Next.js; Root Directory: `frontend`.
3. Vercel will auto-detect and deploy. After deploy you'll get a public URL.

Backend (Render - quickest non-Docker option)
1. Sign in to Render (https://render.com) and click "New" -> "Web Service".
2. Connect GitHub and pick your repo and branch.
3. Environment: Python. Build command: `pip install -r requirements.txt` (or leave blank if Render auto-detects). Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Deploy. Render will provide a public URL (e.g., https://your-app.onrender.com).

Backend (Docker-based hosting)
- If using Render Docker, ECS, or similar, build and push Docker image using `Dockerfile`.

Environment variables
- If you later add secrets, configure them in the host (Vercel/Render) environment settings.

Testing
- After both services are deployed, update the frontend to point to the backend URL (if needed) or configure a proxy.

Need help
- Tell me whether you want me to create the Git commit locally (I will) and then I will provide the exact commands to create the GitHub repo and push. I will not push on your behalf.
