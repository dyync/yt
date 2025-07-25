document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('urlInput');
  const downloadButton = document.getElementById('downloadButton');
  const progressBarContainer = document.getElementById('progressBarContainer');
  const progressBarFill = document.getElementById('progressBarFill');
  const progressText = document.getElementById('progressText');
  const statusMessage = document.getElementById('statusMessage');

  const socket = new WebSocket('ws://localhost:3000');

  socket.onopen = () => {
    console.log('WebSocket connected');
    statusMessage.textContent = 'Ready to download.';
  };

  socket.onmessage = event => {
    const data = JSON.parse(event.data);
    switch (data.type) {
      case 'progress':
        const percentage = data.percentage;
        progressBarFill.style.width = `${percentage}%`;
        progressText.textContent = `${percentage.toFixed(1)}%`;
        progressBarContainer.classList.remove('hidden');
        statusMessage.textContent = `Downloading... ${percentage.toFixed(1)}%`;

        let details = '';
        if (data.downloaded) {
          details += ` ${data.downloaded}`;
        }
        if (data.speed) {
          details += ` at ${data.speed}`;
        }
        if (data.eta) {
          details += ` ETA: ${data.eta}`;
        }
        if (details) {
          statusMessage.textContent += details;
        }
        break;
      case 'complete':
        statusMessage.textContent = data.message;
        progressBarFill.style.width = '100%';
        progressText.textContent = '100%';
        downloadButton.disabled = false;
        break;
      case 'error':
        statusMessage.textContent = `Error: ${data.message}`;
        progressBarContainer.classList.add('hidden');
        downloadButton.disabled = false;
        break;
      case 'message':
        statusMessage.textContent = data.text;
        break;
    }
  };

  socket.onclose = () => {
    console.log('WebSocket disconnected');
    statusMessage.textContent = 'Disconnected from server.';
    downloadButton.disabled = true;
  };

  socket.onerror = error => {
    console.error('WebSocket error:', error);
    statusMessage.textContent = 'WebSocket error. Check server console for details.';
    downloadButton.disabled = true;
  };

  downloadButton.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (url) {
      downloadButton.disabled = true;
      statusMessage.textContent = 'Initiating download...';
      progressBarFill.style.width = '0%';
      progressText.textContent = '0%';
      progressBarContainer.classList.remove('hidden');

      socket.send(JSON.stringify({ type: 'download', url: url }));
    } else {
      statusMessage.textContent = 'Please enter a URL.';
    }
  });
});

const toggleDarkModeBtn = document.getElementById('toggleDarkModeBtn');
toggleDarkModeBtn.onclick = () => {
  document.body.classList.toggle('dark-mode');
  if (document.body.classList.contains('dark-mode')) {
    localStorage.setItem('darkMode', 'enabled');
  } else {
    localStorage.setItem('darkMode', 'disabled');
  }
};
if (localStorage.getItem('darkMode') === 'enabled') {
  document.body.classList.add('dark-mode');
}