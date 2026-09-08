const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');

// Custom MIME types for APK and EXE downloads
express.static.mime.define({
  'application/vnd.android.package-archive': ['apk'],
  'application/vnd.microsoft.portable-executable': ['exe'],
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

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Battle City 1990 server running on http://0.0.0.0:${PORT}`);
  console.log(`- Android APK: http://localhost:${PORT}/battle-city-1990.apk`);
  console.log(`- Windows EXE: http://localhost:${PORT}/battle-city-1990.exe`);
});
