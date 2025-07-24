// app.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Security middleware
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Store user connections
const userConnections = new Map();

// Middleware to generate user ID if new
app.use((req, res, next) => {
  if (!req.cookies.userId) {
    const userId = uuidv4();
    res.cookie('userId', userId, { httpOnly: true });
    req.userId = userId;
    userConnections.set(userId, new Set()); // Store connections for this user
  } else {
    req.userId = req.cookies.userId;
  }
  next();
});

// Static files
app.use(express.static('public'));

// SSE endpoint
app.get('/sse', (req, res) => {
  const userId = req.cookies.userId;
  if (!userId) return res.status(400).send('User ID required');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Add this connection to user's connections
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }
  userConnections.get(userId).add(res);

  // Remove connection when closed
  req.on('close', () => {
    if (userConnections.has(userId)) {
      userConnections.get(userId).delete(res);
    }
  });
});

// API endpoint that generates logs
app.post('/action', (req, res) => {
  const userId = req.cookies.userId;
  const action = req.body.action || 'unknown';

  // Create log message
  const logMessage = {
    timestamp: new Date().toISOString(),
    action,
    userId,
    details: req.body.details || {}
  };

  // Send to all connections for this user
  if (userConnections.has(userId)) {
    const message = `data: ${JSON.stringify(logMessage)}\n\n`;
    userConnections.get(userId).forEach(connection => {
      connection.write(message);
    });
  }

  res.json({ status: 'success' });
});

// Cleanup disconnected clients
setInterval(() => {
  userConnections.forEach((connections, userId) => {
    if (connections.size === 0) {
      userConnections.delete(userId);
    }
  });
}, 30000);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});