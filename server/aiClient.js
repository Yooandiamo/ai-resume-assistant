import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = process.env.AI_LOG_DIR || (process.env.VERCEL ? '/tmp/ai-resume-assistant' : path.join(__dirname, 'data'));
const LOG_FILE = path.join(LOG_DIR, 'ai-logs.jsonl');

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-v4-flash';
const DEFAULT_TIMEOUT_MS = 30000;

function logAiCall({ model, durationMs, inputLength, success, error }) {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    model,
    durationMs,
    inputLength,
    success,
    ...(error ? { error } : {})
  });
  console.log('[AI]', entry);
  fs.appendFile(LOG_FILE, entry + '\n', () => {});
}

export function extractJson(text) {
  if (!text) return text;
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstObject = trimmed.indexOf('{');
  const lastObject = trimmed.lastIndexOf('}');
  if (firstObject >= 0 && lastObject > firstObject) {
    return trimmed.slice(firstObject, lastObject + 1);
  }
  return trimmed;
}

export async function callAi({ prompt, systemInstruction, schema, temperature = 0.2, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.DEEPSEEK_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    throw new Error('Missing DEEPSEEK_API_KEY. Add it to .env.local.');
  }

  const inputLength = (systemInstruction || '').length + (prompt || '').length;
  const startTime = Date.now();

  const schemaInstruction = schema
    ? `\n\n你必须只返回一个合法 JSON 对象，不要使用 Markdown 代码块，不要返回 JSON Schema 定义本身，而是返回符合结构的数据内容。`
    : '';

  const payload = {
    model,
    temperature,
    messages: [
      { role: 'system', content: `${systemInstruction}${schemaInstruction}` },
      { role: 'user', content: prompt }
    ]
  };

  if (schema) {
    payload.response_format = { type: 'json_object' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timeout);
    const durationMs = Date.now() - startTime;
    const message = error.name === 'AbortError'
      ? `AI 请求超时：${Math.round(timeoutMs / 1000)} 秒内未返回。请减少输入材料或稍后重试。`
      : error.message;
    logAiCall({ model, durationMs, inputLength, success: false, error: message });
    throw new Error(message);
  }

  clearTimeout(timeout);
  const durationMs = Date.now() - startTime;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMsg = data?.error?.message || data?.message || `DeepSeek API error: ${response.status}`;
    logAiCall({ model, durationMs, inputLength, success: false, error: errorMsg });
    throw new Error(errorMsg);
  }

  logAiCall({ model, durationMs, inputLength, success: true });
  const text = data?.choices?.[0]?.message?.content || '';
  return schema ? extractJson(text) : text;
}
