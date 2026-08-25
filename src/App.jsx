import React, { useState, useEffect } from 'react';
import { Music, Download, Clipboard, Loader2, CheckCircle2, AlertCircle, Smartphone } from 'lucide-react';

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstall = () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then((choice) => {
      if (choice.outcome === 'accepted') {
        setInstalled(true);
      }
      setInstallPrompt(null);
    });
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        fetchInfo(text);
      }
    } catch {
      // Clipboard access denied or unhandled
    }
  };

  const isValidYoutubeUrl = (str) => {
    return /^(https?:\/\/)?(www\.|music\.)?(youtube\.com|youtu\.be)\/.+$/i.test(str.trim());
  };

  const fetchInfo = async (targetUrl = url) => {
    const cleanUrl = targetUrl.trim();
    if (!cleanUrl) return;

    if (!isValidYoutubeUrl(cleanUrl)) {
      setError('Please enter a valid YouTube or YouTube Music link.');
      setInfo(null);
      return;
    }

    setError('');
    setLoading(true);
    setInfo(null);

    try {
      const res = await fetch(`/api/info?url=${encodeURIComponent(cleanUrl)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch video details.');
      }
      setInfo(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!url) return;
    setDownloading(true);
    setError('');

    try {
      const downloadUrl = `/api/download?url=${encodeURIComponent(url.trim())}`;
      const response = await fetch(downloadUrl);

      if (!response.ok) {
        let errorMsg = 'Failed to download MP3.';
        try {
          const data = await response.json();
          errorMsg = data.error || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }

      const disposition = response.headers.get('Content-Disposition');
      let filename = info?.title ? `${info.title}.mp3` : 'audio.mp3';
      if (disposition && disposition.includes('filename=')) {
        const matches = /filename="?([^";]+)"?/.exec(disposition);
        if (matches && matches[1]) {
          filename = matches[1];
        }
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="app-card">
      <header className="app-header">
        <div className="logo">
          <Music color="#fff" size={24} />
        </div>
        <div>
          <h1>YT Music to MP3</h1>
          <p>Download YouTube audio to your device</p>
        </div>
      </header>

      {installPrompt && !installed && (
        <div className="install-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Smartphone size={18} />
            <span>Install app on phone</span>
          </div>
          <button className="install-btn" onClick={handleInstall}>
            Install
          </button>
        </div>
      )}

      <div className="input-group">
        <input
          type="url"
          className="url-input"
          placeholder="Paste YouTube Music URL..."
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') fetchInfo();
          }}
        />
        <button className="paste-btn" title="Paste link" onClick={handlePaste}>
          <Clipboard size={20} />
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <AlertCircle size={16} inline style={{ marginRight: 6, verticalAlign: 'middle' }} />
          {error}
        </div>
      )}

      {!info && (
        <button
          className="primary-btn"
          disabled={loading || !url.trim()}
          onClick={() => fetchInfo()}
        >
          {loading ? (
            <>
              <Loader2 className="spinner" size={20} />
              Fetching track...
            </>
          ) : (
            'Load Track Details'
          )}
        </button>
      )}

      {info && (
        <>
          <div className="preview-box">
            {info.thumbnail && (
              <img src={info.thumbnail} alt={info.title} className="preview-thumb" />
            )}
            <div className="preview-info">
              <div className="preview-title">{info.title}</div>
              <div className="preview-author">{info.author} • {formatDuration(info.duration)}</div>
            </div>
          </div>

          <button
            className="primary-btn"
            disabled={downloading}
            onClick={handleDownload}
          >
            {downloading ? (
              <>
                <Loader2 className="spinner" size={20} />
                Downloading MP3...
              </>
            ) : (
              <>
                <Download size={20} />
                Download MP3
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
