import { createServer } from 'node:http';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { CLIENT_PORT, HISTORY_DIR, PACKS_DIR, PORT, ROOMS_DIR, UPLOADS_DIR } from './config.js';
import { printBanner } from './net/banner.js';

for (const dir of [PACKS_DIR, ROOMS_DIR, HISTORY_DIR, UPLOADS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true } });

io.on('connection', (socket) => {
  console.log(`[socket] подключение ${socket.id}`);
  socket.on('disconnect', (reason) => {
    console.log(`[socket] отключение ${socket.id}: ${reason}`);
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  printBanner(CLIENT_PORT, PORT);
});
