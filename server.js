import express from 'express';
import cors from 'cors';
import YTDLPWrap from 'yt-dlp-wrap';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const binaryPath = path.join(__dirname, 'yt-dlp');
let ytDlp;

// Ensure yt-dlp binary is available
async function initYtDlp() {
  if (!fs.existsSync(binaryPath)) {
    console.log('Downloading yt-dlp binary...');
    await YTDLPWrap.default.downloadFromGithub(binaryPath);
    fs.chmodSync(binaryPath, '755');
    console.log('yt-dlp binary ready.');
  }
  ytDlp = new YTDLPWrap.default(binaryPath);
}

// Helper to sanitize filenames
function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'audio';
}

// Helper to extract clean video URL
function getCleanUrl(inputUrl) {
  const match = inputUrl.match(/(?:v=|\/v\/|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : inputUrl.split('&')[0];
}

// Helper to get base yt-dlp arguments (using tv and web_embedded clients to bypass datacenter 429 blocks)
function getBaseYtdlpArgs() {
  const args = [
    '--js-runtimes', 'node',
    '--extractor-args', 'youtube:player_client=tv,web_embedded',
  ];

  if (process.env.YOUTUBE_COOKIES) {
    const cookiesPath = path.join(os.tmpdir(), 'yt_cookies.txt');
    try {
      fs.writeFileSync(cookiesPath, process.env.YOUTUBE_COOKIES);
      args.push('--cookies', cookiesPath);
    } catch (e) {
      console.error('Failed to write cookies file:', e);
    }
  }

  return args;
}

// Get video metadata
app.get('/api/info', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }

    const cleanUrl = getCleanUrl(url);

    // Try fast oEmbed API first (immune to rate limits / datacenter IP blocks)
    try {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`);
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        const videoIdMatch = cleanUrl.match(/(?:v=|\/v\/|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
        const videoId = videoIdMatch ? videoIdMatch[1] : '';

        return res.json({
          title: oembedData.title,
          author: oembedData.author_name || 'Unknown Artist',
          duration: 0,
          thumbnail: oembedData.thumbnail_url || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ''),
        });
      }
    } catch (oembedErr) {
      console.warn('oEmbed lookup failed, falling back to yt-dlp:', oembedErr.message);
    }

    // Fallback to yt-dlp
    const rawJson = await ytDlp.execPromise([cleanUrl, ...getBaseYtdlpArgs(), '--dump-json']);
    const info = JSON.parse(rawJson);

    res.json({
      title: info.title,
      author: info.uploader || info.channel || info.artist || 'Unknown Artist',
      duration: Math.round(info.duration || 0),
      thumbnail: info.thumbnail || (info.thumbnails && info.thumbnails[0]?.url),
    });
  } catch (err) {
    console.error('Info Error:', err.message || err);
    res.status(500).json({ error: 'Failed to fetch video details: ' + (err.message || 'Invalid link or video restricted') });
  }
});

// Stream MP3 download
app.get('/api/download', async (req, res) => {
  let tempFilePath = null;
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }

    const cleanUrl = getCleanUrl(url);

    // Get title via oEmbed first (fast & reliable, no extra yt-dlp call)
    let title = 'audio';
    try {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`);
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        title = sanitizeFilename(oembedData.title);
      }
    } catch {}

    tempFilePath = path.join(os.tmpdir(), `yt_mp3_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.mp3`);

    await ytDlp.execPromise([
      cleanUrl,
      ...getBaseYtdlpArgs(),
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--ffmpeg-location', ffmpegPath,
      '-o', tempFilePath
    ]);

    const stats = fs.statSync(tempFilePath);

    res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);
    res.header('Content-Type', 'audio/mpeg');
    res.header('Content-Length', stats.size);

    const readStream = fs.createReadStream(tempFilePath);
    
    const cleanup = () => {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try { fs.unlinkSync(tempFilePath); } catch {}
      }
    };

    readStream.on('end', cleanup);
    readStream.on('error', (err) => {
      console.error('File Read Stream Error:', err);
      cleanup();
    });
    res.on('close', cleanup);

    readStream.pipe(res);
  } catch (err) {
    console.error('Download Error:', err.message || err);
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch {}
    }
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process download: ' + (err.message || 'Download error') });
    }
  }
});

// Serve static frontend files if built
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return;
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

initYtDlp().then(() => {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize yt-dlp binary:', err);
});
