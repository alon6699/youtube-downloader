# YouTube Music to MP3 PWA

A lightweight Progressive Web App (PWA) to download MP3 audio from YouTube and YouTube Music URLs directly on mobile and desktop.

## Features

- **PWA Ready**: Install directly on iOS, Android, or desktop home screens.
- **YouTube & YouTube Music Support**: Handles `youtube.com` and `music.youtube.com` links.
- **Track Preview**: Displays video title, artist/channel, duration, and thumbnail before downloading.
- **Clipboard Integration**: Quick paste button for rapid link input.
- **Lightweight Backend**: Streams audio direct to response without saving local temp files.

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Development

Start the development server with API proxying:

```bash
npm run server
```

In another terminal window:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

### 3. Production Build & Run

Build the frontend static assets and run the Express server:

```bash
npm run build
npm start
```

Access the app at `http://localhost:3001`.

## Deployment (Free & Automatic)

The recommended free host for this app is **[Render.com](https://render.com)** because it supports Node.js background audio processing (`ffmpeg` & `yt-dlp` binaries) and offers **automatic deployment on git push**.

### Deploying to Render:

1. Push your repository to **GitHub**.
2. Go to **[Render Dashboard](https://dashboard.render.com/)** -> **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Set the following settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Click **Create Web Service**.

Render will build the React PWA, bundle `ffmpeg`, download `yt-dlp`, and give you a free HTTPS URL (e.g., `https://your-app.onrender.com`).

> **Automatic Redeploys**: Every time you `git push` new changes to your GitHub main branch, Render automatically rebuilds and redeploys the app!
