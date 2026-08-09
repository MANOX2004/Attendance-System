# 📘 Face Recognition Attendance System

> **A modern, web‑based attendance solution using Node.js, Express, and face‑api.js**

## 🚀 Quick Start

1️⃣ **Clone the repository** (if you haven't already)
```bash
git clone https://github.com/MANOX2004/Attendance-System.git
cd Attendance-System
```

2️⃣ **Install dependencies**
```bash
npm install
```

3️⃣ **Download the required face‑api models**
```bash
node scripts/download_models.js
```

4️⃣ **Run the server**
```bash
npm start   # or `npm run dev`
```

5️⃣ Open your browser → `http://localhost:3000`

---

## 🛠️ Features

- **💁‍♀️ Student Management** – Add, list, and delete students via a simple REST API.
- **📸 Real‑time Face Recognition** – Uses `face-api.js` models to recognise faces directly in the browser.
- **⏰ Attendance Logging** – Mark **IN** / **OUT** scans, store timestamps, and retrieve logs.
- **📊 Statistics Dashboard** – Get total students, present today, and total scans.
- **🔐 CORS enabled** – Easy to integrate with other front‑ends or mobile apps.
- **⚡️ Light‑weight** – Pure Node.js backend, no heavy databases required (data stored in JSON).

---

## 📁 Project Structure
```
Attendance-System/
├─ public/                # Front‑end assets (HTML, CSS, JS)
│  ├─ images/            # Avatar images
│  ├─ js/                # Client‑side scripts
│  ├─ models/            # Face‑api model files (downloaded via script)
│  └─ index.html         # Main page
├─ scripts/               # Helper scripts (download models)
│  └─ download_models.js
├─ data/                  # JSON‑based DB (students, attendance)
├─ server.js              # Express server & API routes
├─ db.js                  # Simple JSON‑file data layer
├─ package.json
└─ README.md              # <‑ **You are reading it!**
```

---

## 📦 Dependencies
| Dependency | Purpose |
|------------|---------|
| **express** | HTTP server & routing |
| **cors** | Enable cross‑origin requests |
| **face-api.js** (client‑side) | Face detection & recognition |
| **nodemon** *(dev)* | Auto‑restart during development |

---

## 🧑‍💻 Development

- **Run in watch mode** (auto‑restart on changes)
```bash
npm install -g nodemon   # if you don't have it
nodemon server.js
```
- **Add new API routes** – edit `server.js` and extend the `db.js` helper.
- **Update UI** – modify files under `public/`.

---

## 🐞 Troubleshooting

- **Models not loading** – Ensure you ran `node scripts/download_models.js` and the `public/models/` folder contains the `.json` and shard files.
- **Port already in use** – Change the `PORT` variable in `server.js` or set `PORT=4000` before starting:
```bash
set PORT=4000 && npm start
```
- **CORS errors** – The server already uses `cors()`. If you call the API from another domain, make sure the origin is allowed.

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

Enjoy building smarter attendance systems! 🎉
