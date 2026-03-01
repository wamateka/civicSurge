import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Make io globally accessible from API routes
  (global as any).io = io;

  io.on('connection', (socket) => {
    console.log('[Socket.io] Client connected:', socket.id);

    socket.on('disconnect', () => {
      console.log('[Socket.io] Client disconnected:', socket.id);
    });

    // Volunteer joins their personal room for targeted notifications
    socket.on('join:volunteer', (volunteerId: string) => {
      socket.join(`volunteer:${volunteerId}`);
      console.log(`[Socket.io] Volunteer ${volunteerId} joined room`);
    });

    // Admin joins admin room
    socket.on('join:admin', () => {
      socket.join('admin');
    });
  });

  // Initialize MQTT subscriber (non-fatal — app works without MQTT)
  try {
    const { initMqtt } = require('./src/lib/mqtt');
    initMqtt();
  } catch (err) {
    console.warn('[MQTT] Failed to initialize (non-fatal):', (err as Error).message);
  }

  httpServer.listen(port, () => {
    console.log(`\n  ╔═══════════════════════════════════════╗`);
    console.log(`  ║     🚨 CivicSurge Command Center      ║`);
    console.log(`  ║   Ready on http://${hostname}:${port}        ║`);
    console.log(`  ╚═══════════════════════════════════════╝\n`);
  });
});
