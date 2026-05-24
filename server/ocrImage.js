import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { v4 as uuidv4 } from 'uuid';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, 'ocr-image.swift');

const isMac = process.platform === 'darwin';

async function extractWithVision(file) {
  const ext = path.extname(file.originalname || '') || '.png';
  const tempPath = path.join(os.tmpdir(), `ai-resume-ocr-${uuidv4()}${ext}`);
  await fs.writeFile(tempPath, file.buffer);

  try {
    const { stdout, stderr } = await execFileAsync('swift', [scriptPath, tempPath], {
      timeout: 20000,
      maxBuffer: 2 * 1024 * 1024,
      env: {
        ...process.env,
        CLANG_MODULE_CACHE_PATH: path.join(os.tmpdir(), 'ai-resume-clang-cache')
      }
    });
    const text = stdout.trim();
    if (!text) {
      throw new Error(stderr?.trim() || '图片中未识别到文字，请确保图片清晰且包含中文或英文文本。');
    }
    return text;
  } finally {
    await fs.rm(tempPath, { force: true });
  }
}

async function extractWithTesseract(file) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('chi_sim+eng', 1, {
    logger: () => {} // suppress progress logs
  });

  try {
    const { data } = await worker.recognize(file.buffer);
    const text = data.text.trim();
    if (!text) {
      throw new Error('图片中未识别到文字，请确保图片清晰且包含中文或英文文本。');
    }
    return text;
  } finally {
    await worker.terminate();
  }
}

export async function extractImageText(file) {
  if (isMac) {
    return extractWithVision(file);
  }
  return extractWithTesseract(file);
}
