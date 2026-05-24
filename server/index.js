import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = createApp();
const distDir = path.join(__dirname, '..', 'dist');
const port = process.env.PORT || 5173;

app.use(express.static(distDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`AI Resume Assistant running on http://localhost:${port}`);
});
