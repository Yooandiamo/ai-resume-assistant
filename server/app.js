import express from 'express';
import multer from 'multer';
import { callAi } from './aiClient.js';
import { parseUploadedFile } from './fileParser.js';
import {
  analyzeResume,
  extractMaterialFacts,
  generateInterviewPrep,
  generateResume,
  generateResumeDocx,
  handleFollowUp,
  renderResumeMarkdown,
  renderResumePdf,
  renderResumeText,
  rewriteResumeBullets,
  rewriteResumeLine
} from './resumeWorkflow.js';
import {
  authenticateUser,
  createSession,
  createProject,
  createUser,
  deleteSession,
  deleteProject,
  getProject,
  getUserByEmail,
  getUserBySession,
  listProjects,
  updateProject
} from './dataStore.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

function decodeUploadName(name = '') {
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return /[ÃÂäåæçèé]/.test(name) ? decoded : name;
}

const SESSION_COOKIE = 'resume_session';

function parseCookies(cookieHeader = '') {
  return Object.fromEntries(cookieHeader.split(';').map(part => {
    const [key, ...value] = part.trim().split('=');
    return [key, decodeURIComponent(value.join('=') || '')];
  }).filter(([key]) => key));
}

function sessionCookieOptions(expiresAt) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}={value}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${secure}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function validateAuthPayload(body = {}, mode = 'login') {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const name = String(body.name || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '请输入有效邮箱。';
  if (password.length < 8) return '密码至少需要 8 位。';
  if (mode === 'register' && name.length > 40) return '姓名不能超过 40 个字符。';
  return null;
}

async function attachUser(req, _res, next) {
  const cookies = parseCookies(req.headers.cookie || '');
  req.sessionId = cookies[SESSION_COOKIE];
  req.user = await getUserBySession(req.sessionId);
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: '请先登录。' });
    return;
  }
  next();
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));
  app.use(attachUser);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'ai-resume-assistant' });
  });

  app.get('/api/auth/me', (req, res) => {
    res.json({ user: req.user || null });
  });

  app.post('/api/auth/register', async (req, res) => {
    const error = validateAuthPayload(req.body, 'register');
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const body = req.body || {};
    const email = String(body.email).trim().toLowerCase();
    try {
      if (await getUserByEmail(email)) {
        res.status(409).json({ error: '这个邮箱已经注册，请直接登录。' });
        return;
      }
      const user = await createUser({ email, name: body.name, password: body.password });
      const session = await createSession(user.id);
      res.setHeader('Set-Cookie', sessionCookieOptions(session.expiresAt).replace('{value}', session.id));
      res.status(201).json({ user });
    } catch (err) {
      res.status(500).json({ error: err.message || '注册失败。' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const error = validateAuthPayload(req.body, 'login');
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const user = await authenticateUser(req.body.email, req.body.password);
    if (!user) {
      res.status(401).json({ error: '邮箱或密码不正确。' });
      return;
    }
    const session = await createSession(user.id);
    res.setHeader('Set-Cookie', sessionCookieOptions(session.expiresAt).replace('{value}', session.id));
    res.json({ user });
  });

  app.post('/api/auth/logout', async (req, res) => {
    await deleteSession(req.sessionId);
    res.setHeader('Set-Cookie', clearSessionCookie());
    res.status(204).send();
  });

  app.post('/api/ai', requireAuth, async (req, res) => {
    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEBUG_AI_PROXY !== 'true') {
      res.status(404).json({ error: 'Not found.' });
      return;
    }
    try {
      const { prompt, systemInstruction, schema } = req.body || {};
      if (!prompt || !systemInstruction) {
        res.status(400).json({ error: 'prompt and systemInstruction are required.' });
        return;
      }
      const text = await callAi({ prompt, systemInstruction, schema });
      res.json({ text });
    } catch (error) {
      res.status(500).json({ error: error.message || 'AI request failed.' });
    }
  });

  app.post('/api/files/parse', requireAuth, upload.array('files', 8), async (req, res) => {
    try {
      const files = req.files || [];
      const parsed = await Promise.all(files.map(async file => {
        try {
          const text = await parseUploadedFile(file);
          return {
            name: decodeUploadName(file.originalname),
            mimetype: file.mimetype,
            size: file.size,
            text,
            status: 'ok'
          };
        } catch (err) {
          return {
            name: decodeUploadName(file.originalname),
            mimetype: file.mimetype,
            size: file.size,
            text: '',
            status: 'error',
            error: err.message || '解析失败'
          };
        }
      }));
      res.json({ files: parsed });
    } catch (error) {
      res.status(400).json({ error: error.message || '文件解析失败。' });
    }
  });

  app.get('/api/projects', requireAuth, async (req, res) => {
    res.json({ projects: await listProjects(req.user.id) });
  });

  app.post('/api/projects', requireAuth, async (req, res) => {
    res.status(201).json({ project: await createProject(req.body || {}, req.user.id) });
  });

  app.get('/api/projects/:id', requireAuth, async (req, res) => {
    const project = await getProject(req.params.id, req.user.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    res.json({ project });
  });

  app.patch('/api/projects/:id', requireAuth, async (req, res) => {
    const project = await updateProject(req.params.id, req.body || {}, req.user.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    res.json({ project });
  });

  app.delete('/api/projects/:id', requireAuth, async (req, res) => {
    const deleted = await deleteProject(req.params.id, req.user.id);
    res.status(deleted ? 204 : 404).send();
  });

  app.post('/api/resume/generate', requireAuth, async (req, res) => {
    try {
      const resume = await generateResume(req.body || {});
      res.json({ resume });
    } catch (error) {
      res.status(500).json({ error: error.message || '简历生成失败。' });
    }
  });

  app.post('/api/resume/generate-async', requireAuth, async (req, res) => {
    try {
      const body = req.body || {};
      const projectPayload = {
        title: '简历生成中...',
        mode: body.mode || 'optimize',
        jd: body.jd || '',
        status: 'generating',
        materials: {
          files: [
            ...(body.jdFiles || []).map(f => ({ ...f, category: 'jd' })),
            ...(body.resumeFiles || []).map(f => ({ ...f, category: 'resume' })),
            ...(body.materialsFiles || []).map(f => ({ ...f, category: 'material' }))
          ],
          combinedText: body.materialsText || ''
        }
      };
      const project = body.projectId
        ? await updateProject(body.projectId, { ...projectPayload, error: null }, req.user.id)
        : await createProject(projectPayload, req.user.id);
      if (!project) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }
      res.json({ project });
      // 后台异步生成，不阻塞响应
      generateResume(body).then(resume => {
        const title = resume?.name ? `${resume.name}_${resume.targetRole || '简历'}_初稿` : '简历初稿';
        updateProject(project.id, { resume, status: 'ready', title }, project.userId);
      }).catch(error => {
        console.error('Async generate failed:', error.message);
        updateProject(project.id, { status: 'failed', error: error.message }, project.userId);
      });
    } catch (error) {
      res.status(500).json({ error: error.message || '创建生成任务失败。' });
    }
  });

  app.post('/api/resume/analyze', requireAuth, async (req, res) => {
    try {
      const analysis = await analyzeResume(req.body || {});
      res.json({ analysis });
    } catch (error) {
      res.status(500).json({ error: error.message || '简历诊断失败。' });
    }
  });

  app.post('/api/resume/rewrite-line', requireAuth, async (req, res) => {
    try {
      const body = req.body || {};
      // 如果有 bullets 数组，走批量改写；否则走单句改写
      const result = body.bullets
        ? await rewriteResumeBullets(body)
        : await rewriteResumeLine(body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message || '局部改写失败。' });
    }
  });

  app.post('/api/resume/interview-prep', requireAuth, async (req, res) => {
    try {
      const result = await generateInterviewPrep(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message || '面试问题生成失败。' });
    }
  });

  app.post('/api/resume/follow-up', requireAuth, async (req, res) => {
    try {
      const resume = await handleFollowUp(req.body || {});
      res.json({ resume });
    } catch (error) {
      res.status(500).json({ error: error.message || '补充信息处理失败。' });
    }
  });

  app.post('/api/resume/extract-facts', requireAuth, async (req, res) => {
    try {
      const facts = await extractMaterialFacts(req.body || {});
      res.json(facts);
    } catch (error) {
      res.status(500).json({ error: error.message || '资料事实提取失败。' });
    }
  });

  app.post('/api/resume/export/text', requireAuth, (req, res) => {
    const text = renderResumeText(req.body?.resume || {});
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(text);
  });

  app.post('/api/resume/export/markdown', requireAuth, (req, res) => {
    const md = renderResumeMarkdown(req.body?.resume || {});
    const name = (req.body?.resume?.name || 'resume').replace(/[\\/:*?"<>|]/g, '_');
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}.md"`);
    res.send(md);
  });

  app.post('/api/resume/export/docx', requireAuth, async (req, res) => {
    try {
      const buffer = await generateResumeDocx(req.body?.resume || {});
      const name = (req.body?.resume?.name || 'resume').replace(/[\\/:*?"<>|]/g, '_');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}.docx"`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: error.message || 'Word 导出失败。' });
    }
  });

  app.post('/api/resume/export/pdf', requireAuth, async (req, res) => {
    try {
      const buffer = await renderResumePdf(req.body?.resume || {});
      const name = (req.body?.resume?.name || 'resume').replace(/[\\/:*?"<>|]/g, '_');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}.pdf"`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: error.message || 'PDF 导出失败。' });
    }
  });

  return app;
}
