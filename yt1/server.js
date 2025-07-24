const express = require('express');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR);
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const server = app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
  console.log('Client connected');

  ws.on('message', message => {
    const data = JSON.parse(message);
    if (data.type === 'download' && data.url) {
      console.log(`Starting download for: ${data.url}`);

      const outputPath = path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s');

      const ytDlpProcess = spawn('yt-dlp', [
        '-o', outputPath,
        data.url,
        '--newline',
        '--no-color',
        '--progress'
      ]);

      ytDlpProcess.stdout.on('data', output => {
        const outputStr = output.toString();
        const progressMatch = outputStr.match(/\[download\]\s+(\d+\.?\d*)% of (~?\d+\.?\d*[KMGTPE]?i?B) at (~?\d+\.?\d*[KMGTPE]?i?B\/s)?(?: ETA (\d{2}:\d{2}))?/);

        if (progressMatch) {
          const percentage = parseFloat(progressMatch[1]);
          const downloadedSize = progressMatch[2];
          const speed = progressMatch[3];
          const eta = progressMatch[4];

          ws.send(JSON.stringify({
            type: 'progress',
            percentage: percentage,
            downloaded: downloadedSize,
            speed: speed,
            eta: eta
          }));
        } else if (outputStr.includes('[download] Destination:')) {
          ws.send(JSON.stringify({ type: 'message', text: outputStr.trim() }));
        } else if (outputStr.includes('has already been downloaded')) {
          ws.send(JSON.stringify({ type: 'message', text: outputStr.trim() }));
        }
      });

      ytDlpProcess.stderr.on('data', error => {
        const errorStr = error.toString();
        console.error(`yt-dlp stderr: ${errorStr}`);
        ws.send(JSON.stringify({ type: 'error', message: errorStr }));
      });

      ytDlpProcess.on('close', code => {
        console.log(`yt-dlp process exited with code ${code}`);
        if (code === 0) {
          ws.send(JSON.stringify({ type: 'complete', message: 'Download finished!' }));
        } else {
          ws.send(JSON.stringify({ type: 'error', message: `Download failed with code ${code}` }));
        }
      });

      ytDlpProcess.on('error', err => {
        console.error(`Failed to start yt-dlp process: ${err.message}`);
        ws.send(JSON.stringify({ type: 'error', message: `Server error: Could not start yt-dlp. Is it installed and in your PATH? (${err.message})` }));
      });
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', error => {
    console.error('WebSocket error:', error);
  });
});