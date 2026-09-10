const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');
const STATS_FILE = path.join(__dirname, 'stats.json');

// Initialize stats store if it doesn't exist
function getStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const content = fs.readFileSync(STATS_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading stats.json:', err);
  }

  return {
    totalVisits: 0,
    uniqueVisitors: 0,
    apkDownloads: 0,
    exeDownloads: 0,
    gamesPlayed: 0,
    uniqueClients: {},
    history: {},
    lastUpdated: new Date().toISOString(),
  };
}

function saveStats(data) {
  try {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving stats.json:', err);
  }
}

function recordEvent(event, clientId) {
  const stats = getStats();
  const today = new Date().toISOString().split('T')[0];

  if (!stats.history[today]) {
    stats.history[today] = { visits: 0, unique: 0, apk: 0, exe: 0, plays: 0 };
  }

  if (event === 'visit') {
    stats.totalVisits = (stats.totalVisits || 0) + 1;
    stats.history[today].visits = (stats.history[today].visits || 0) + 1;

    if (clientId && !stats.uniqueClients[clientId]) {
      stats.uniqueClients[clientId] = today;
      stats.uniqueVisitors = Object.keys(stats.uniqueClients).length;
      stats.history[today].unique = (stats.history[today].unique || 0) + 1;
    }
  } else if (event === 'download_apk') {
    stats.apkDownloads = (stats.apkDownloads || 0) + 1;
    stats.history[today].apk = (stats.history[today].apk || 0) + 1;
  } else if (event === 'download_exe') {
    stats.exeDownloads = (stats.exeDownloads || 0) + 1;
    stats.history[today].exe = (stats.history[today].exe || 0) + 1;
  } else if (event === 'play_game') {
    stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
    stats.history[today].plays = (stats.history[today].plays || 0) + 1;
  }

  saveStats(stats);
  return stats;
}

// Enable CORS for frontend requests
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// JSON and text body parser for sendBeacon / fetch
app.use(express.json());
app.use(express.text({ type: '*/*' }));

// API: Record Telemetry Event
app.post('/api/track', (req, res) => {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const event = body.event || 'visit';
  const clientId = body.clientId;

  recordEvent(event, clientId);
  res.json({ ok: true });
});

// API: Read Telemetry Stats
app.get('/api/stats', (req, res) => {
  const stats = getStats();
  const today = new Date().toISOString().split('T')[0];
  const todayStats = stats.history[today] || { visits: 0, unique: 0, apk: 0, exe: 0, plays: 0 };

  res.json({
    totalVisits: stats.totalVisits || 0,
    uniqueVisitors: stats.uniqueVisitors || 0,
    apkDownloads: stats.apkDownloads || 0,
    exeDownloads: stats.exeDownloads || 0,
    gamesPlayed: stats.gamesPlayed || 0,
    lastUpdated: stats.lastUpdated,
    today: {
      date: today,
      visits: todayStats.visits || 0,
      unique: todayStats.unique || 0,
      apk: todayStats.apk || 0,
      exe: todayStats.exe || 0,
      plays: todayStats.plays || 0,
    },
  });
});

// HTML: Standalone Admin Web Dashboard
app.get('/admin/stats', (req, res) => {
  const stats = getStats();
  const today = new Date().toISOString().split('T')[0];
  const todayStats = stats.history[today] || { visits: 0, unique: 0, apk: 0, exe: 0, plays: 0 };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Battle City 1990 - Live Telemetry</title>
  <meta http-equiv="refresh" content="30">
  <style>
    body { font-family: monospace, sans-serif; background: #0c0c0e; color: #eee; margin: 0; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; background: #141418; border: 2px solid #333; border-radius: 8px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.8); }
    h1 { color: #f8b800; font-size: 20px; border-bottom: 2px solid #222; padding-bottom: 12px; margin-top: 0; display: flex; justify-content: space-between; align-items: center; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
    .card { background: #1c1c24; border: 1px solid #2d2d38; border-radius: 6px; padding: 15px; }
    .card-title { font-size: 11px; color: #888; text-transform: uppercase; margin-bottom: 6px; }
    .card-value { font-size: 28px; font-weight: bold; }
    .v-blue { color: #58b8d8; }
    .v-green { color: #10b981; }
    .v-gold { color: #f8b800; }
    .v-cyan { color: #06b6d4; }
    .v-purple { color: #a855f7; }
    .today-box { background: #181820; border: 1px solid #333; border-radius: 6px; padding: 15px; margin-top: 15px; }
    .today-grid { display: grid; grid-template-columns: repeat(4, 1fr); text-align: center; gap: 10px; margin-top: 10px; }
    .footer { font-size: 11px; color: #666; margin-top: 20px; text-align: center; }
    .badge { font-size: 10px; padding: 3px 8px; border-radius: 4px; background: #222; color: #10b981; border: 1px solid #10b981; }
  </style>
</head>
<body>
  <div class="container">
    <h1>
      <span>BATTLE CITY 1990 - LIVE STATS</span>
      <span class="badge">LIVE (30s REFRESH)</span>
    </h1>
    <div class="grid">
      <div class="card">
        <div class="card-title">Total Visits</div>
        <div class="card-value v-blue">${(stats.totalVisits || 0).toLocaleString()}</div>
      </div>
      <div class="card">
        <div class="card-title">Unique Visitors</div>
        <div class="card-value v-green">${(stats.uniqueVisitors || 0).toLocaleString()}</div>
      </div>
      <div class="card">
        <div class="card-title">Games Played</div>
        <div class="card-value v-gold">${(stats.gamesPlayed || 0).toLocaleString()}</div>
      </div>
      <div class="card">
        <div class="card-title">Android APK Downloads</div>
        <div class="card-value v-green">${(stats.apkDownloads || 0).toLocaleString()}</div>
      </div>
      <div class="card">
        <div class="card-title">Windows EXE Downloads</div>
        <div class="card-value v-cyan">${(stats.exeDownloads || 0).toLocaleString()}</div>
      </div>
      <div class="card">
        <div class="card-title">Total Downloads</div>
        <div class="card-value v-purple">${((stats.apkDownloads || 0) + (stats.exeDownloads || 0)).toLocaleString()}</div>
      </div>
    </div>

    <div class="today-box">
      <div style="font-size: 12px; color: #f8b800; font-weight: bold;">TODAY'S ACTIVITY (${today})</div>
      <div class="today-grid">
        <div><div style="font-size: 10px; color: #888;">VISITS</div><div style="font-size: 18px; font-weight: bold; color: #fff;">${todayStats.visits || 0}</div></div>
        <div><div style="font-size: 10px; color: #888;">APK DL</div><div style="font-size: 18px; font-weight: bold; color: #10b981;">${todayStats.apk || 0}</div></div>
        <div><div style="font-size: 10px; color: #888;">EXE DL</div><div style="font-size: 18px; font-weight: bold; color: #06b6d4;">${todayStats.exe || 0}</div></div>
        <div><div style="font-size: 10px; color: #888;">PLAYS</div><div style="font-size: 18px; font-weight: bold; color: #f8b800;">${todayStats.plays || 0}</div></div>
      </div>
    </div>

    <div class="footer">
      Last Synchronized: ${new Date(stats.lastUpdated).toLocaleString()} &bull; Discretely recorded on VPS
    </div>
  </div>
</body>
</html>`;
  res.send(html);
});

// Direct Download interceptors to automatically count downloads
app.get('/battle-city-1990.apk', (req, res, next) => {
  recordEvent('download_apk');
  next();
});

app.get('/battle-city-1990.exe', (req, res, next) => {
  recordEvent('download_exe');
  next();
});



// Serve static assets with caching and range support for large downloads
app.use(express.static(DIST_DIR, {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.apk')) {
      res.setHeader('Content-Disposition', 'attachment; filename="Battle City 1990.apk"');
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    } else if (filePath.endsWith('.exe')) {
      res.setHeader('Content-Disposition', 'attachment; filename="Battle City 1990.exe"');
      res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
    }
  }
}));

// Fallback for SPA routing (compatible with Express 4 and Express 5)
app.use((req, res) => {
  const indexPath = fs.existsSync(path.join(DIST_DIR, 'index.html')) 
    ? path.join(DIST_DIR, 'index.html') 
    : path.join(__dirname, 'index.html');
  res.sendFile(indexPath);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Battle City 1990 server running on http://0.0.0.0:${PORT}`);
  console.log(`- Live Stats: http://localhost:${PORT}/admin/stats`);
  console.log(`- Android APK: http://localhost:${PORT}/battle-city-1990.apk`);
  console.log(`- Windows EXE: http://localhost:${PORT}/battle-city-1990.exe`);
});
