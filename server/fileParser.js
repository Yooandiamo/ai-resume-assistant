import path from 'node:path';
import { extractImageText } from './ocrImage.js';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

export async function parseUploadedFile(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = file.mimetype || '';

  if (ext === '.txt' || ext === '.md' || mime.startsWith('text/')) {
    return file.buffer.toString('utf8');
  }

  if (ext === '.docx' || mime.includes('wordprocessingml')) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value;
  }

  if (ext === '.pdf' || mime === 'application/pdf') {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: file.buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (IMAGE_EXTENSIONS.has(ext) || mime.startsWith('image/')) {
    const text = await extractImageText(file);
    return text || `【图片文件：${file.originalname}】未识别到清晰文字，请上传更清晰的图片或粘贴文本。`;
  }

  throw new Error('暂不支持该文件格式。当前支持 PDF、Word、TXT、Markdown、PNG、JPG、WEBP。');
}
