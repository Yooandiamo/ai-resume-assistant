import { callAi } from './aiClient.js';
import { existsSync } from 'node:fs';

// ==========================================
// 文本截断工具
// ==========================================
const MAX_AI_TEXT = 32000;

function compactText(text = '', limit = MAX_AI_TEXT) {
  if (!text || text.length <= limit) return text;
  const head = text.slice(0, Math.floor(limit * 0.65));
  const tail = text.slice(-Math.floor(limit * 0.25));
  return `${head}\n\n【中间内容过长，已自动省略部分文本以提升 AI 处理速度】\n\n${tail}`;
}

// ==========================================
// Schema 定义（统一管理，前端不再重复定义）
// ==========================================
const resumeSchema = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    contact: { type: 'STRING' },
    targetRole: { type: 'STRING' },
    summary: { type: 'ARRAY', items: { type: 'STRING' } },
    work: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          company: { type: 'STRING' },
          time: { type: 'STRING' },
          role: { type: 'STRING' },
          bullets: { type: 'ARRAY', items: { type: 'STRING' } }
        }
      }
    },
    projects: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          time: { type: 'STRING' },
          bullets: { type: 'ARRAY', items: { type: 'STRING' } }
        }
      }
    }
  }
};

const analysisSchema = {
  type: 'OBJECT',
  properties: {
    score: { type: 'INTEGER' },
    preference: { type: 'STRING' },
    skills: { type: 'ARRAY', items: { type: 'STRING' } },
    risks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          quote: { type: 'STRING' },
          reason: { type: 'STRING' },
          suggestion: { type: 'STRING' }
        }
      }
    },
    missing: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          topic: { type: 'STRING' },
          prompt: { type: 'STRING' }
        }
      }
    }
  }
};

const bulletsRewriteSchema = {
  type: 'OBJECT',
  properties: {
    bullets: { type: 'ARRAY', items: { type: 'STRING' } }
  }
};

const singleLineSchema = {
  type: 'OBJECT',
  properties: {
    rewritten_text: { type: 'STRING' }
  }
};

const interviewSchema = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          intent: { type: 'STRING' },
          suggestion: { type: 'STRING' }
        }
      }
    }
  }
};

// ==========================================
// 生成约束文案（所有生成类 prompt 共用）
// ==========================================
const GENERATION_CONSTRAINTS = [
  '优先使用用户明确提供的信息。',
  '可以优化表达，但不要虚构公司、岗位、项目、学历、证书或具体数据。',
  '如果用户没有提供量化结果，不要编造百分比、金额、人数等指标，可以使用"提升""优化""支持"等非具体表达。',
  '使用适度的 STAR 思路组织经历，让内容更贴合目标岗位。',
  '根据用户工作年限调整表达强度，应届生不要写成高级管理者。'
].join('\n');

// ==========================================
// 1. 简历生成
// ==========================================
export async function generateResume({ jd = '', resumeText = '', scratchData = null, materialsText = '', mode = 'optimize' }) {
  const isOptimize = mode === 'optimize' && resumeText;
  let inputResume = '';
  if (resumeText) {
    inputResume = compactText(resumeText, MAX_AI_TEXT);
  } else if (scratchData) {
    inputResume = [
      `【基础信息】`,
      `目标岗位：${scratchData.targetRole || jd || ''}`,
      `当前岗位：${scratchData.currentRole || ''}`,
      `工作年限：${scratchData.yearsExp || ''}`,
      `教育背景：${scratchData.education || ''}`,
      `目标城市：${scratchData.city || ''}`,
      `技能/工具：${scratchData.skills || ''}`,
      `\n【工作经历陈述】`,
      scratchData.workSnippet || '',
      `\n【项目经历陈述】`,
      scratchData.projectSnippet || ''
    ].join('\n');
  }

  const inputJD = compactText(jd, 10000);
  const inputMaterials = compactText(materialsText, 10000);

  const optimizeInstruction = isOptimize ? [
    '【核心原则 — 优化模式】',
    '你收到的是一份完整的现有简历。你的任务是保留原有内容，只做最小化调整以贴合 JD。',
    '',
    '必须遵守：',
    '1. 公司名称、岗位名称、起止时间、项目名称 — 原文原样保留，不要改动任何一个字',
    '2. 每段工作经历和项目经历都要出现在输出中，不能遗漏任何一条',
    '3. 每条 bullet 的核心事实和数据保持不变，只能在表达方式上微调（如：用更贴合 JD 的关键词替换近义词）',
    '4. 不要删除原文中的任何经历或 bullet',
    '5. 不要新增原文没有的职责、成果或项目',
    '6. 如果原文表述已经很好，就保持原样不动',
    '7. work 和 projects 数组必须包含原文中的所有经历，不为空',
    '',
    '简单说：这份简历是用户已经认可的版本，你只需帮它更匹配 JD，不要重写。'
  ].join('\n') : '';

  const prompt = [
    isOptimize
      ? '请根据目标岗位 JD 对以下现有简历做最小化优化。保留原内容，仅微调表达以更贴合 JD 关键词。'
      : '请根据目标岗位、用户资料和补充资料生成结构化简历 JSON。',
    '',
    `【目标岗位/JD】`,
    inputJD,
    '',
    `【${isOptimize ? '现有简历（请提取所有经历，不要遗漏）' : '用户资料'}】`,
    inputResume,
    '',
    `【补充资料】`,
    inputMaterials || '（无）',
    '',
    '生成原则：',
    GENERATION_CONSTRAINTS,
    optimizeInstruction ? `\n${optimizeInstruction}` : '',
    '',
    '输出 JSON 结构（所有字段均为必填）：',
    '{',
    '  "name": "姓名",',
    '  "contact": "联系方式（手机/邮箱等）",',
    '  "targetRole": "目标岗位名称",',
    '  "summary": ["个人优势要点1", "要点2", ...],',
    '  "work": [',
    '    { "company": "公司名", "time": "起止时间", "role": "岗位名", "bullets": ["工作要点1", "要点2", ...] }',
    '  ],',
    '  "projects": [',
    '    { "name": "项目名", "time": "起止时间", "bullets": ["项目要点1", "要点2", ...] }',
    '  ]',
    '}'
  ].join('\n');

  const systemInstruction = isOptimize
    ? '你是专业的简历优化助手。你收到的是一份用户已经认可的完整简历。你只能做最小化微调——保留所有事实（公司、时间、岗位、职责），仅在表达上做细微优化以更贴合 JD。不得删除、新增或重写任何经历。严格输出 JSON。'
    : '你是专业的简历内容生成助手。严格输出 JSON，所有内容必须基于用户资料，不得编造事实。';

  const text = await callAi({
    prompt,
    schema: resumeSchema,
    systemInstruction
  });
  return JSON.parse(text);
}

// ==========================================
// 2. 简历诊断 / 匹配度分析
// ==========================================
export async function analyzeResume({ jd = '', resume = null, sourceText = '' }) {
  const prompt = [
    '分析简历与岗位的匹配度，并指出内容风险和信息缺口。',
    '',
    `【JD】`,
    jd,
    '',
    `【简历】`,
    JSON.stringify(resume),
    '',
    sourceText ? `【原始来源资料】\n${compactText(sourceText, 8000)}\n` : '',
    '',
    '请重点检查：',
    '1. 是否贴合 JD 的职责、能力和关键词。',
    '2. 是否存在"主导、搭建、架构、显著提升、增长XX%"等缺少支撑的高风险表述。',
    '3. 哪些信息需要向用户追问后才能写得更具体。',
    '',
    '输出 JSON 结构（所有字段均为必填）：',
    '{',
    '  "score": 数字(0-100，匹配度评分),',
    '  "preference": "匹配度文字说明",',
    '  "skills": ["匹配的技能1", "技能2", ...],',
    '  "risks": [',
    '    { "quote": "原文引用", "reason": "风险原因", "suggestion": "修改建议" }',
    '  ],',
    '  "missing": [',
    '    { "topic": "信息缺口主题", "prompt": "追问用户的问题" }',
    '  ]',
    '}'
  ].filter(Boolean).join('\n');

  const text = await callAi({
    prompt,
    schema: analysisSchema,
    systemInstruction: '你是严苛但建设性的简历诊断系统。只输出 JSON。不要为了提高匹配度而鼓励虚构经历或数据。'
  });
  return JSON.parse(text);
}

// ==========================================
// 3. 单句改写（局部改写面板）
// ==========================================
export async function rewriteResumeLine({ jd = '', text = '', instruction = '' }) {
  const prompt = [
    '改写句子：',
    `【原句】`,
    text,
    '',
    `【参考 JD】`,
    jd,
    '',
    `【指令】`,
    instruction,
    '',
    '约束：',
    '1. 不要新增原句没有支撑的事实。',
    '2. 如果指令要求"增加数据感"，只能强化已有数据或把表述改成更可量化的方向，不能编造具体数字。',
    '3. 输出适合直接放进中文简历的一句话。',
    '',
    '输出 JSON 结构：',
    '{ "rewritten_text": "改写后的句子" }'
  ].join('\n');

  const result = await callAi({
    prompt,
    schema: singleLineSchema,
    systemInstruction: '输出专业的简历表达，精简有力。不得编造数据或夸大职责。'
  });
  return JSON.parse(result);
}

// ==========================================
// 4. 批量改写 bullets（一段经历的多条要点）
// ==========================================
export async function rewriteResumeBullets({ jd = '', bullets = [], contextDesc = '' }) {
  const prompt = [
    `重写以下${contextDesc || '经历'}的条目。`,
    '',
    `【JD】`,
    jd,
    '',
    `【原版】`,
    JSON.stringify(bullets),
    '',
    '要求：',
    '1. 更贴合 JD，使用具体动作动词。',
    '2. 保持真实性，不要新增原文没有支撑的公司、职责、项目或具体数据。',
    '3. 原文已有数据时可以强化表达；原文没有数据时，不要编造百分比、金额、人数等指标。',
    '4. 语气专业、简洁、有成果感，但避免过度夸张。',
    '',
    '输出 JSON 结构：',
    '{ "bullets": ["重写后的要点1", "要点2", ...] }'
  ].join('\n');

  const result = await callAi({
    prompt,
    schema: bulletsRewriteSchema,
    systemInstruction: '输出包含所有重写句子的数组。所有内容必须基于原文和 JD，不得编造事实。'
  });
  return JSON.parse(result);
}

// ==========================================
// 5. 面试追问预测
// ==========================================
export async function generateInterviewPrep({ jd = '', resume = null }) {
  const prompt = [
    '根据简历和 JD，提出 3 个最可能被追问的面试问题，并提供 STAR 回答建议。',
    '',
    `【JD】`,
    jd,
    '',
    `【简历】`,
    JSON.stringify(resume),
    '',
    '请优先覆盖：项目细节、成果数据来源、职责边界、岗位匹配度风险。',
    '',
    '输出 JSON 结构：',
    '{',
    '  "questions": [',
    '    { "question": "面试问题", "intent": "追问意图", "suggestion": "STAR回答建议" }',
    '  ]',
    '}'
  ].join('\n');

  const text = await callAi({
    prompt,
    schema: interviewSchema,
    systemInstruction: '你是专业的面试教练系统。只输出 JSON。帮助求职者准备面试追问，但不要编造经历。'
  });
  return JSON.parse(text);
}

// ==========================================
// 6. 追问补充 — 根据用户回答更新简历相关部分
// ==========================================
export async function handleFollowUp({ jd = '', resume = null, topic = '', question = '', answer = '' }) {
  const prompt = [
    '用户针对简历中的一个信息缺口提供了补充信息。请根据补充内容更新简历的相关部分。',
    '',
    `【目标 JD】`,
    jd,
    '',
    `【当前简历】`,
    JSON.stringify(resume),
    '',
    `【缺失主题】${topic}`,
    `【追问问题】${question}`,
    `【用户补充回答】${answer}`,
    '',
    '要求：',
    '1. 将用户补充的信息整合进简历的对应模块（summary/work/projects）。',
    '2. 保持原有简历中其他未涉及部分不变。',
    '3. 不要虚构用户没有提供的新数据或事实。',
    '4. 优化表达使其专业、贴合 JD。',
    '',
    '输出完整简历 JSON 结构（所有字段均为必填）：',
    '{',
    '  "name": "姓名",',
    '  "contact": "联系方式",',
    '  "targetRole": "目标岗位名称",',
    '  "summary": ["个人优势要点", ...],',
    '  "work": [{ "company": "公司名", "time": "起止时间", "role": "岗位名", "bullets": ["要点", ...] }],',
    '  "projects": [{ "name": "项目名", "time": "起止时间", "bullets": ["要点", ...] }]',
    '}'
  ].join('\n');

  const text = await callAi({
    prompt,
    schema: resumeSchema,
    systemInstruction: '你是专业的简历内容编辑。只输出更新后的完整简历 JSON。基于用户补充信息，整合进简历对应部分。不得编造额外事实。'
  });
  return JSON.parse(text);
}

// ==========================================
// 7. 资料事实提取
// ==========================================
const factSchema = {
  type: 'OBJECT',
  properties: {
    facts: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          category: { type: 'STRING' },
          fact: { type: 'STRING' },
          source: { type: 'STRING' }
        }
      }
    }
  }
};

export async function extractMaterialFacts({ materialsText = '', existingResume = null }) {
  const prompt = [
    '从用户提供的补充资料中提取可用于简历的关键事实。',
    '每个事实需标注类别和来源。不要编造资料中没有的信息。',
    '',
    `【补充资料】`,
    compactText(materialsText, 12000),
    '',
    existingResume ? `【当前简历摘要 — 仅用于去重，不要重复已有内容】\n${JSON.stringify(existingResume).slice(0, 2000)}\n` : '',
    '',
    '类别可选：项目成果、量化指标、职责描述、技能工具、团队协作、其他',
    '',
    '输出 JSON 结构：',
    '{',
    '  "facts": [',
    '    { "category": "类别", "fact": "提取的事实描述", "source": "来源文件名或段落" }',
    '  ]',
    '}'
  ].filter(Boolean).join('\n');

  const text = await callAi({
    prompt,
    schema: factSchema,
    systemInstruction: '你是一个信息提取系统。只从给定的补充资料中提取事实，不编造任何信息。'
  });
  return JSON.parse(text);
}

// ==========================================
// 8. 导出
// ==========================================
export function renderResumeText(resume) {
  const lines = [];
  lines.push(resume.name || '未命名');
  if (resume.contact) lines.push(resume.contact);
  if (resume.targetRole) lines.push(`求职意向：${resume.targetRole}`);

  if (resume.summary?.length) {
    lines.push('\n个人优势');
    resume.summary.forEach(item => lines.push(`- ${item}`));
  }

  if (resume.work?.length) {
    lines.push('\n工作经历');
    resume.work.forEach(item => {
      lines.push(`${item.company || ''}｜${item.role || ''}｜${item.time || ''}`);
      item.bullets?.forEach(bullet => lines.push(`- ${bullet}`));
    });
  }

  if (resume.projects?.length) {
    lines.push('\n项目经历');
    resume.projects.forEach(item => {
      lines.push(`${item.name || ''}｜${item.time || ''}`);
      item.bullets?.forEach(bullet => lines.push(`- ${bullet}`));
    });
  }

  return lines.join('\n');
}

export function renderResumeMarkdown(resume) {
  const md = [];
  md.push(`# ${resume.name || '未命名'}`);
  if (resume.contact) md.push(`\n${resume.contact}`);
  if (resume.targetRole) md.push(`\n**求职意向：** ${resume.targetRole}`);

  if (resume.summary?.length) {
    md.push('\n## 个人优势\n');
    resume.summary.forEach(item => md.push(`- ${item}`));
  }

  if (resume.work?.length) {
    md.push('\n## 工作经历\n');
    resume.work.forEach(item => {
      md.push(`### ${item.company || ''}｜${item.role || ''}`);
      md.push(`*${item.time || ''}*\n`);
      item.bullets?.forEach(bullet => md.push(`- ${bullet}`));
      md.push('');
    });
  }

  if (resume.projects?.length) {
    md.push('## 项目经历\n');
    resume.projects.forEach(item => {
      md.push(`### ${item.name || ''}`);
      md.push(`*${item.time || ''}*\n`);
      item.bullets?.forEach(bullet => md.push(`- ${bullet}`));
      md.push('');
    });
  }

  return md.join('\n');
}

const CJK_FONT_PATHS = [
  '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
  '/System/Library/Fonts/STHeiti Medium.ttc',
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttf',
  '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttf',
];

function findCJKFont() {
  for (const p of CJK_FONT_PATHS) {
    if (existsSync(p)) return p;
  }
  return null;
}

export async function renderResumePdf(resume) {
  const { default: PDFDocument } = await import('pdfkit');
  const fontPath = findCJKFont();

  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    bufferPages: true,
    info: {
      Title: `${resume.name || '未命名'} - 简历`,
      Author: resume.name || ''
    }
  });

  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));

  const FONT = fontPath ? 'CJK' : 'Helvetica';
  if (fontPath) {
    doc.registerFont('CJK', fontPath);
  }

  const margin = 50;
  const pageWidth = 595.28 - margin * 2;

  // Helper: check remaining space and add page break if needed
  let currentY = margin;
  const lineHeight = (size) => size * 1.6;
  const bulletIndent = 15;

  function ensureSpace(needed) {
    if (currentY + needed > 841.89 - margin) {
      doc.addPage();
      currentY = margin;
    }
  }

  function writeText(text, { fontSize = 10, bold = false, align = 'left', indent = 0, color = '#1e293b' } = {}) {
    doc.font(FONT).fontSize(fontSize).fillColor(color);
    const opts = { align, width: pageWidth - indent, continued: false };
    const textHeight = doc.heightOfString(text, opts);
    ensureSpace(textHeight + 4);
    doc.text(text, margin + indent, currentY, opts);
    currentY += textHeight + 4;
  }

  function writeBullet(text) {
    doc.font(FONT).fontSize(10).fillColor('#334155');
    const opts = { width: pageWidth - bulletIndent, continued: false };
    const textHeight = doc.heightOfString(text, opts);
    ensureSpace(textHeight + 3);
    doc.text(`•  ${text}`, margin + bulletIndent, currentY, opts);
    currentY += textHeight + 3;
  }

  function writeHr() {
    ensureSpace(15);
    currentY += 6;
    doc.moveTo(margin, currentY).lineTo(margin + pageWidth, currentY).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
    currentY += 10;
  }

  // === Name ===
  doc.font(FONT).fontSize(22).fillColor('#0f172a');
  doc.text(resume.name || '未命名', margin, currentY, { align: 'center', width: pageWidth });
  currentY += lineHeight(22) + 6;

  // === Contact ===
  if (resume.contact) {
    doc.font(FONT).fontSize(10).fillColor('#64748b');
    doc.text(resume.contact, margin, currentY, { align: 'center', width: pageWidth });
    currentY += lineHeight(10) + 4;
  }

  // === Target Role ===
  if (resume.targetRole) {
    doc.font(FONT).fontSize(11).fillColor('#475569');
    doc.text(`求职意向：${resume.targetRole}`, margin, currentY, { align: 'center', width: pageWidth });
    currentY += lineHeight(11) + 4;
  }

  writeHr();

  // === Summary ===
  if (resume.summary?.length) {
    doc.font(FONT).fontSize(14).fillColor('#0f172a');
    ensureSpace(lineHeight(14) + 6);
    doc.text('个人优势', margin, currentY, { width: pageWidth });
    currentY += lineHeight(14) + 6;

    resume.summary.forEach(item => writeBullet(item));
    currentY += 8;
  }

  // === Work Experience ===
  if (resume.work?.length) {
    doc.font(FONT).fontSize(14).fillColor('#0f172a');
    ensureSpace(lineHeight(14) + 6);
    doc.text('工作经历', margin, currentY, { width: pageWidth });
    currentY += lineHeight(14) + 6;

    resume.work.forEach(item => {
      const header = `${item.company || ''} ｜ ${item.role || ''}`;
      doc.font(FONT).fontSize(12).fillColor('#1e293b');
      ensureSpace(lineHeight(12) + 4);
      doc.text(header, margin, currentY, { width: pageWidth });
      currentY += lineHeight(12) + 2;

      if (item.time) {
        doc.font(FONT).fontSize(9).fillColor('#94a3b8');
        doc.text(item.time, margin, currentY, { width: pageWidth });
        currentY += lineHeight(9) + 4;
      }

      if (item.bullets?.length) {
        item.bullets.forEach(bullet => writeBullet(bullet));
      }
      currentY += 6;
    });
  }

  // === Projects ===
  if (resume.projects?.length) {
    doc.font(FONT).fontSize(14).fillColor('#0f172a');
    ensureSpace(lineHeight(14) + 6);
    doc.text('项目经历', margin, currentY, { width: pageWidth });
    currentY += lineHeight(14) + 6;

    resume.projects.forEach(item => {
      const header = item.name || '未命名项目';
      doc.font(FONT).fontSize(12).fillColor('#1e293b');
      ensureSpace(lineHeight(12) + 4);
      doc.text(header, margin, currentY, { width: pageWidth });
      currentY += lineHeight(12) + 2;

      if (item.time) {
        doc.font(FONT).fontSize(9).fillColor('#94a3b8');
        doc.text(item.time, margin, currentY, { width: pageWidth });
        currentY += lineHeight(9) + 4;
      }

      if (item.bullets?.length) {
        item.bullets.forEach(bullet => writeBullet(bullet));
      }
      currentY += 6;
    });
  }

  doc.end();
  return new Promise(resolve => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export async function generateResumeDocx(resume) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx');

  const children = [];

  children.push(new Paragraph({
    text: resume.name || '未命名',
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER
  }));

  if (resume.contact) {
    children.push(new Paragraph({
      text: resume.contact,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    }));
  }

  if (resume.targetRole) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: '求职意向：', bold: true }),
        new TextRun(resume.targetRole)
      ],
      spacing: { after: 300 }
    }));
  }

  if (resume.summary?.length) {
    children.push(new Paragraph({
      text: '个人优势',
      heading: HeadingLevel.HEADING_2
    }));
    resume.summary.forEach(item => {
      children.push(new Paragraph({
        text: item,
        bullet: { level: 0 },
        spacing: { after: 60 }
      }));
    });
  }

  if (resume.work?.length) {
    children.push(new Paragraph({
      text: '工作经历',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300 }
    }));
    resume.work.forEach(item => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${item.company || ''}｜${item.role || ''}`, bold: true }),
        ],
        spacing: { before: 200, after: 40 }
      }));
      children.push(new Paragraph({
        text: item.time || '',
        italics: true,
        spacing: { after: 80 }
      }));
      item.bullets?.forEach(bullet => {
        children.push(new Paragraph({
          text: bullet,
          bullet: { level: 0 },
          spacing: { after: 60 }
        }));
      });
    });
  }

  if (resume.projects?.length) {
    children.push(new Paragraph({
      text: '项目经历',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300 }
    }));
    resume.projects.forEach(item => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: item.name || '', bold: true }),
        ],
        spacing: { before: 200, after: 40 }
      }));
      children.push(new Paragraph({
        text: item.time || '',
        italics: true,
        spacing: { after: 80 }
      }));
      item.bullets?.forEach(bullet => {
        children.push(new Paragraph({
          text: bullet,
          bullet: { level: 0 },
          spacing: { after: 60 }
        }));
      });
    });
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Microsoft YaHei', size: 22 }
        }
      }
    },
    sections: [{ children }]
  });

  return await Packer.toBuffer(doc);
}
