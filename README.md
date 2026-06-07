# Diesel Generator Log & Billing System (GenOps)

A responsive, high-fidelity log sheet tracker and professional billing invoice generator. Crafted with **React (with Vite)**, **Tailwind CSS**, and **Firebase (Firestore & Auth)** to handle generator hours, diesel rates, and automated multi-zone calculations securely.

---

## 🎨 Architecture & Technical Stack
- **Frontend SPA**: React, Tailwind CSS, Lucide Icons, and Motion animations.
- **Backend & Serving**: Hybrid Express custom server (`server.ts`) for development asset routing and production optimized static delivery.
- **Database / Auth**: Firebase Firestore database + Authentication with a clean configuration fallback structure.
- **CI/CD Platform**: Automated GitHub Actions integration (`deploy-pages.yml`) for automated builds and static hosting.

---

## 📥 Local Development Quickstart

To run the application locally on your computer:

```bash
# 1. Clone your github repository:
git clone https://github.com/engineersenterprisesmdu-jpg/GenOps.git
cd GenOps

# 2. Install dependencies:
npm install

# 3. Start the Vite-Express development server:
npm run dev
```
The application will boot up at **`http://localhost:3000`**.

---

## 🚀 Step 1: Push Project to GitHub

To publish this codebase onto your GitHub account, run the following commands in your computer's terminal:

```bash
# Initialize local repository
git init -b main

# Add all project source files (excluding folders registered in .gitignore)
git add .

# Commit files loaded
git commit -m "feat: initial release"

# Link your local repo to your GitHub remote
git remote add origin https://github.com/engineersenterprisesmdu-jpg/GenOps.git

# Push changes safely to main
git push -u origin main
```

---

## ☁️ Step 2: Automated Hosting with GitHub Pages (Recommended)

This project is pre-configured with a custom GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) that automatically builds and deploys your application to **GitHub Pages** when you push code to `main` or `master`.

### 1. Enable GitHub Actions Permissions
Before pushing or dispatching the workflow, you must allow your actions to write updates to your repository (required for publishing to `gh-pages` branch):
1. Go to your GitHub Repository homepage: **https://github.com/engineersenterprisesmdu-jpg/GenOps**
2. Click **Settings** (⚙️) -> **Actions** -> **General**.
3. Scroll down to **Workflow permissions**.
4. Select **Read and write permissions** and toggle on **"Allow GitHub Actions to create and approve pull requests"**.
5. Click **Save**.

### 2. Configure Dynamic Base Paths
To prevent broken resource URLs (`404` errors for JavaScript and CSS bundles), we have modified `vite.config.ts` to automatically detect if it is running within GitHub Pages, appending your repository directory segment `/GenOps/` dynamically. You don't have to keep changing configs manually!

### 3. Setup Firebase Secrets (Security Hardening)
If you want to keep your project fully public *without exposing your actual Firebase access keys in Git index history*:
1. Add `firebase-applet-config.json` directly to your local `.gitignore` if you choose to make it private.
2. In your GitHub repository, go to **Settings** -> **Secrets and variables** -> **Actions**.
3. Add the following **Repository Secrets** (matching your Firebase project credentials):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_DATABASE_ID`

Once pushed, go to the **Actions** tab on your GitHub repository to watch your build compile and deploy in real-time! Your app will be live at `https://engineersenterprisesmdu-jpg.github.io/GenOps/`.

---

## 🐳 Step 3: Deploying Full-Stack to the Cloud (Alternative)

If you prefer to deploy the application with its live Node/Express server (`server.ts`) instead of pure static hosting, we have added a multi-stage `Dockerfile`. 

You can connect your GitHub repository directly to any of the following platforms for automatic compilation on git commits:

### A. Google Cloud Run / Google Cloud Build
Google Cloud Run directly imports this custom Docker container:
```bash
gcloud run deploy genops --source . --port 3000 --allow-unauthenticated
```

### B. Render / Railway / Fly.io
1. Create a new Web Service on [Render](https://render.com) or [Railway](https://railway.app).
2. Connect your GitHub repository.
3. The platform will automatically detect the **Dockerfile** at the root, build the Docker container stages, expose port `3000`, and provide you with a permanent HTTPS cloud URL!
