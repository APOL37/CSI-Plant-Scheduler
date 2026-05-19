# 🏭 RMC Plant Operations Scheduler

**Ready-Mix Concrete · Role-Based Production & Logistics Dashboard**

A full-featured plant operations scheduler with role-based access for 4 process owners:
**Plant Manager · Batch Plant Operator · Dispatcher / Logistics · QC / Lab Technician**

---

## 🚀 Deploy to GitHub Pages — Step by Step

### Prerequisites
- [Git](https://git-scm.com/downloads) installed on your computer
- [Node.js 18+](https://nodejs.org/) installed
- A [GitHub account](https://github.com)

---

### Step 1 — Create a GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Set **Repository name** — e.g. `rmc-plant-scheduler`
3. Set visibility to **Public** (required for free GitHub Pages)
4. ✅ Leave "Initialize with README" **unchecked**
5. Click **Create repository**

---

### Step 2 — Update the Base Path

Open `vite.config.js` and replace `rmc-plant-scheduler` with your **exact** repo name:

```js
// vite.config.js
export default defineConfig({
  plugins: [react()],
  base: '/YOUR-REPO-NAME-HERE/',   // ← change this
})
```

> **Example:** if your repo is `github.com/juandelacruz/my-rmc-app` → set `base: '/my-rmc-app/'`

---

### Step 3 — Initialize and Push

Open your terminal in the project folder, then run:

```bash
# Install dependencies
npm install

# Initialize git
git init
git add .
git commit -m "Initial commit — RMC Plant Scheduler"

# Connect to your GitHub repo (replace URL with yours)
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git

# Push to main branch
git branch -M main
git push -u origin main
```

---

### Step 4 — Enable GitHub Pages

1. Go to your repo on GitHub
2. Click **Settings** → **Pages** (left sidebar)
3. Under **Source**, select **GitHub Actions**
4. Click **Save**

The GitHub Action will automatically trigger. Wait ~1 minute.

---

### Step 5 — Access Your Live App 🎉

Your app will be live at:

```
https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/
```

> **Example:** `https://juandelacruz.github.io/rmc-plant-scheduler/`

---

## 🔄 Updating the App

Every time you push to `main`, GitHub Actions will automatically rebuild and redeploy:

```bash
# Make your changes, then:
git add .
git commit -m "Update: describe your change here"
git push
```

Deployment takes about 60 seconds after each push.

---

## 👤 Demo Login PINs

| User | Role | PIN |
|------|------|-----|
| Arnel Macapagal | 🏭 Plant Manager | `1111` |
| Rodel Santos | ⚙️ Batch Operator (BP1) | `2222` |
| Jun Reyes | ⚙️ Batch Operator (BP2) | `3333` |
| Cris Dizon | 📡 Dispatcher | `4444` |
| Donna Aquino | 🔬 QC / Lab Tech | `5555` |

---

## 📁 Project Structure

```
rmc-plant-scheduler/
├── .github/
│   └── workflows/
│       └── deploy.yml       ← Auto-deploy on push to main
├── src/
│   ├── App.jsx              ← Main scheduler application
│   ├── main.jsx             ← React entry point
│   └── index.css            ← Global reset styles
├── index.html               ← HTML entry point
├── vite.config.js           ← Vite config (set base path here)
├── package.json             ← Dependencies & scripts
└── .gitignore
```

---

## 🛠 Local Development

```bash
npm install       # Install dependencies
npm run dev       # Start local dev server → http://localhost:5173
npm run build     # Build for production → /dist
npm run preview   # Preview production build locally
```

---

## ✨ Features

- **4 Role-Based Dashboards** — each user sees only their scope
- **PIN Login** — per-user 4-digit authentication
- **Gantt Timeline** — drag-and-drop job rescheduling
- **Dispatch List** — tabular view with one-click status cycling
- **QC / Mix Design** — grade summary by batch
- **Finance Tab** — volume, rates, and estimated revenue (Plant Manager only)
- **⏱ Uptime / Downtime Logging** — per-asset availability tracking with visual bars
- **User Management** — permissions matrix (Plant Manager only)

---

## 📄 License

Internal use — RMC Plant Operations. Not for public distribution.
