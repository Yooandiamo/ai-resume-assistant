import React, { useState, useEffect } from 'react';
import {
  FileText, Sparkles, UploadCloud, Target, Briefcase,
  ChevronRight, FileEdit, PenTool, CheckCircle,
  Check, Info, FileBadge, ChevronDown, ChevronUp,
  Loader2, X, AlertCircle
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { compactForAi } from '../../lib/apiClient';
import { UploadDropzone, FileList, ACCEPTED_UPLOAD_TYPES } from './UploadDropzone';

function StepNavItem({ number, title, active, onClick }) {
  return (
    <div onClick={onClick} className={`relative flex items-center p-2 rounded-lg cursor-pointer transition-all ${active ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold z-10 border-2 transition-colors ${active ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-300 text-slate-400'}`}>{number}</div>
      <span className={`ml-3 text-sm transition-colors ${active ? 'font-bold text-indigo-900' : 'font-medium text-slate-500'}`}>{title}</span>
    </div>
  );
}

export function InitFlowView() {
  const { initMode: mode, setCurrentView, setProjectData } = useProject();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeSection, setActiveSection] = useState('jd');

  const [jdName, setJdName] = useState("");
  const [jdText, setJdText] = useState("");
  const [jdFiles, setJdFiles] = useState([]);
  const [showFullJdInput, setShowFullJdInput] = useState(false);

  const [resumeTab, setResumeTab] = useState('upload');
  const [resumeText, setResumeText] = useState("");
  const [resumeFiles, setResumeFiles] = useState([]);

  const [scratchData, setScratchData] = useState({
    yearsExp: '', currentRole: '', education: '', city: '',
    workSnippet: '', projectSnippet: '', skills: ''
  });

  const [materials, setMaterials] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);

  const calcCompleteness = () => {
    let score = 0;
    if (jdName.length > 2) score += 15;
    if (jdText.length > 20 || jdFiles.length > 0) score += 20;
    if (mode === 'optimize') {
      if (resumeText.length > 50 || resumeFiles.length > 0) score += 45;
    } else {
      if (scratchData.currentRole && scratchData.yearsExp) score += 15;
      if (scratchData.workSnippet.length > 10) score += 20;
      if (scratchData.projectSnippet.length > 10) score += 10;
      if (scratchData.education || scratchData.skills) score += 5;
    }
    if (materials.length > 0) score += 20;
    return Math.min(score, 100);
  };

  const completeness = calcCompleteness();

  useEffect(() => {
    if (mode === 'demo') {
      setIsProcessing(true);
      setTimeout(() => {
        setProjectData({
          jd: "岗位职责：\n1. 负责B端企业用户的全生命周期运营。\n2. 搭建数据看板，通过数据分析驱动策略优化。\n3. 跨部门协同产研团队落地复杂解决方案。\n岗位要求：\n1. 3年以上相关经验。\n2. 具备优秀的沟通协调能力。",
          title: "张三_高级产品运营",
          resume: {
            name: "张三", contact: "13800000000 | zhangsan@email.com", targetRole: "高级产品运营",
            summary: ["具备 3 年用户运营经验，擅长从 0 到 1 搭建用户分层体系，熟悉 B 端企业客户生命周期管理。", "具备较强的数据驱动能力，熟练掌握 SQL 与数据看板搭建。"],
            work: [{ company: "某科技有限责任公司", time: "2022.07 - 至今", role: "B端产品运营", bullets: ["负责平台企业用户的日常运营工作，围绕转化与留存目标，设计并落地分层运营策略。", "参与内部业务管理系统建设，梳理业务流程并输出产品需求文档 (PRD)，提升内部处理效率。"] }],
            projects: [
              { name: "618 会员增长与精准召回项目", time: "2023.05 - 2023.06", bullets: ["设计短信、社群资源的联动触达。根据 RFM 模型分层针对流失用户制定专属召回方案。", "活动期间触达用户 15 万+，推动会员订单量环比增长 18%。"] },
              { name: "内部业务管理系统重构", time: "2022.09 - 2023.01", bullets: ["参与业务管理系统需求梳理和产品方案设计。", "协同开发团队完成系统上线，提升了内部审批和数据查询效率。"] }
            ]
          },
          analysis: null
        });
        setCurrentView('workspace');
      }, 1000);
    }
  }, [mode]);

  const checklist = mode === 'optimize' ? [
    { key: 'jd', label: '目标岗位', required: true, done: jdName.trim().length > 0 },
    { key: 'resume', label: '现有简历', required: true, done: resumeText.trim().length > 0 || resumeFiles.length > 0 },
    { key: 'materials', label: '补充资料', required: false, done: materials.length > 0, bonus: true }
  ] : [
    { key: 'jd', label: '目标岗位', required: true, done: jdName.trim().length > 0 },
    { key: 'base', label: '当前岗位/年限', required: true, done: scratchData.currentRole.trim().length > 0 && scratchData.yearsExp !== '' },
    { key: 'work', label: '工作经历描述', required: true, done: scratchData.workSnippet.trim().length > 0 },
    { key: 'project', label: '项目具体信息', required: false, done: scratchData.projectSnippet.trim().length > 0 },
    { key: 'edu', label: '教育背景', required: false, done: scratchData.education.trim().length > 0 },
    { key: 'skills', label: '技能与工具', required: false, done: scratchData.skills.trim().length > 0 },
    { key: 'materials', label: '补充资料', required: false, done: materials.length > 0, bonus: true }
  ];

  const requiredItems = checklist.filter(i => i.required);
  const doneRequiredCount = requiredItems.filter(i => i.done).length;
  const isReady = doneRequiredCount === requiredItems.length;

  const processUploadFiles = async (selectedFiles, setter) => {
    if (!selectedFiles.length) return;
    const pendingFiles = selectedFiles.map(file => ({
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
      status: 'parsing'
    }));
    setter(prev => [...prev, ...pendingFiles]);
    try {
      const formData = new FormData();
      selectedFiles.forEach(file => formData.append('files', file, file.name));
      const response = await fetch('/api/files/parse', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '文件解析失败');
      const parsedFiles = data.files.map((file, idx) => ({
        name: file.name || selectedFiles[idx]?.name,
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        text: file.text || '',
        status: file.status === 'error' ? 'error' : 'ready',
        error: file.error || undefined
      }));
      setter(prev => {
        const withoutPending = prev.filter(item => !pendingFiles.some(pending => pending.name === item.name && item.status === 'parsing'));
        return [...withoutPending, ...parsedFiles];
      });
    } catch (error) {
      setter(prev => {
        const withoutPending = prev.filter(item => !pendingFiles.some(pending => pending.name === item.name && item.status === 'parsing'));
        return [...withoutPending, ...selectedFiles.map(f => ({
          name: f.name,
          size: `${(f.size / 1024 / 1024).toFixed(1)} MB`,
          text: '',
          status: 'error',
          error: error.message || '解析失败'
        }))];
      });
    }
  };

  const handleFileUpload = (setter) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = ACCEPTED_UPLOAD_TYPES;
    input.onchange = async () => {
      const selectedFiles = Array.from(input.files || []);
      await processUploadFiles(selectedFiles, setter);
    };
    input.click();
  };

  const handleGenerate = async () => {
    if (!isReady) return;
    setIsProcessing(true);
    try {
      const parsedJdText = compactForAi(jdFiles.map(file => `【${file.name}】\n${file.text || ''}`).join('\n\n'), 16000);
      const parsedResumeText = compactForAi(resumeFiles.map(file => `【${file.name}】\n${file.text || ''}`).join('\n\n'), 32000);
      const parsedMaterialsText = compactForAi(materials.map(file => `【${file.name}】\n${file.text || ''}`).join('\n\n'), 20000);
      const inputJD = compactForAi(`${jdName}\n${jdText}\n${parsedJdText}`.trim(), 16000);
      const inputResume = mode === 'optimize' ? compactForAi([resumeText, parsedResumeText].filter(Boolean).join('\n\n'), 32000) : '';

      const response = await fetch('/api/resume/generate-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jd: inputJD,
          resumeText: inputResume,
          scratchData: mode === 'scratch' ? { ...scratchData, targetRole: jdName } : null,
          materialsText: parsedMaterialsText,
          jdFiles: jdFiles.map(f => ({ name: f.name, size: f.size, status: f.status })),
          resumeFiles: resumeFiles.map(f => ({ name: f.name, size: f.size, status: f.status })),
          materialsFiles: materials.map(f => ({ name: f.name, size: f.size, status: f.status })),
          mode
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '创建生成任务失败');

      const allMaterialsFiles = [
        ...jdFiles.map(f => ({ name: f.name, size: f.size, status: f.status, category: 'jd' })),
        ...resumeFiles.map(f => ({ name: f.name, size: f.size, status: f.status, category: 'resume' })),
        ...materials.map(f => ({ name: f.name, size: f.size, status: f.status, category: 'material' }))
      ];

      setProjectData({
        id: data.project?.id,
        mode,
        jd: inputJD,
        title: '简历生成中...',
        resume: { name: '生成中...', contact: '', targetRole: jdName || '未填写', summary: [], work: [], projects: [] },
        analysis: null,
        _asyncProjectId: data.project?.id,
        _status: 'generating',
        _materialsText: parsedMaterialsText,
        _materialsFiles: allMaterialsFiles,
        _originalResumeText: inputResume
      });
      setCurrentView('workspace');
    } catch (error) {
      alert(error.message || '创建任务失败，请重试。');
      setIsProcessing(false);
    }
  };

  if (mode === 'demo') {
    return (
      <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-fade-in">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="font-medium text-slate-600">正在载入演示数据与 AI 环境...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50 relative">
      <div className="absolute top-0 left-0 right-0 h-10 bg-indigo-50/80 border-b border-indigo-100 flex items-center justify-center z-10">
        <p className="text-xs font-medium text-indigo-700">
          当前正在创建：<strong className="text-indigo-900">{mode === 'optimize' ? '优化已有简历' : '从零生成简历'}</strong>
        </p>
      </div>

      <div className="w-[240px] bg-white border-r border-slate-200 shrink-0 hidden lg:flex flex-col mt-10">
        <div className="p-6 border-b border-slate-200"><h2 className="text-lg font-bold text-slate-900">输入资料</h2><p className="text-xs text-slate-500 mt-1">录入信息以启动 AI 分析</p></div>
        <div className="flex-1 p-4 space-y-2 relative">
          <div className="absolute left-[31px] top-8 bottom-12 w-px bg-slate-200 z-0"></div>
          <StepNavItem number="1" title="目标岗位" active={activeSection === 'jd'} onClick={() => setActiveSection('jd')} />
          <StepNavItem number="2" title={mode === 'optimize' ? "现有简历" : "基础信息与经历"} active={activeSection === 'resume'} onClick={() => setActiveSection('resume')} />
          <StepNavItem number="3" title="补充资料 (可选)" active={activeSection === 'materials'} onClick={() => setActiveSection('materials')} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative custom-scrollbar scroll-smooth mt-10">
        <div className="max-w-3xl mx-auto py-8 px-6 lg:px-12 space-y-8 pb-32">

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group" onMouseEnter={() => setActiveSection('jd')}>
            <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-[15px] font-bold text-slate-800 flex items-center"><Target className="w-4 h-4 mr-2 text-indigo-600"/> 1. 目标岗位 <span className="text-rose-500 ml-1">*</span></h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <input type="text" value={jdName} onChange={e => setJdName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white transition-colors" placeholder="你想投递什么岗位？(例如：高级用户运营、ToB 产品经理)"/>
              </div>
              {!showFullJdInput ? (
                <button onClick={() => setShowFullJdInput(true)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center bg-indigo-50/50 px-3 py-1.5 rounded-md transition-colors">
                  有完整 JD？上传或粘贴，分析会更准确 <ChevronDown className="w-3 h-3 ml-1"/>
                </button>
              ) : (
                <div className="pt-4 border-t border-slate-100 animate-fade-in">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-bold text-slate-700">目标岗位详情 (JD)</label>
                    <button onClick={() => setShowFullJdInput(false)} className="text-xs text-slate-400 flex items-center hover:text-slate-600">收起 <ChevronUp className="w-3 h-3 ml-0.5"/></button>
                  </div>
                  {jdFiles.length === 0 ? (
                    <div className="flex gap-4">
                      <UploadDropzone className="w-1/3 min-h-[120px]" title="上传 JD 文件" onPick={() => handleFileUpload(setJdFiles)} onDropFiles={(files) => processUploadFiles(files, setJdFiles)} />
                      <div className="flex-1 relative">
                        <textarea value={jdText} onChange={e => setJdText(e.target.value)} className="w-full h-full min-h-[120px] border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none bg-white transition-colors" placeholder="或在此处粘贴 JD 文本..."/>
                      </div>
                    </div>
                  ) : (<FileList files={jdFiles} onRemove={(idx) => setJdFiles(jdFiles.filter((_, i) => i !== idx))} onPreview={setPreviewFile} />)}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group" onMouseEnter={() => setActiveSection('resume')}>
            {mode === 'optimize' ? (
              <>
                <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="text-[15px] font-bold text-slate-800 flex items-center"><FileText className="w-4 h-4 mr-2 text-indigo-600"/> 2. 现有简历 <span className="text-rose-500 ml-1">*</span></h3>
                  <div className="flex bg-slate-200/60 rounded-lg p-0.5">
                    <button onClick={() => setResumeTab('upload')} className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${resumeTab === 'upload' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>上传文件</button>
                    <button onClick={() => setResumeTab('text')} className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${resumeTab === 'text' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>粘贴文本</button>
                  </div>
                </div>
                <div className="p-6">
                  {resumeTab === 'upload' ? (
                    resumeFiles.length === 0 ? (
                      <UploadDropzone title="拖拽简历文件到此处，或点击浏览" large icon="upload" onPick={() => handleFileUpload(setResumeFiles)} onDropFiles={(files) => processUploadFiles(files, setResumeFiles)} />
                    ) : (<FileList files={resumeFiles} onRemove={(idx) => setResumeFiles(resumeFiles.filter((_, i) => i !== idx))} onPreview={setPreviewFile} />)
                  ) : (<textarea value={resumeText} onChange={e => setResumeText(e.target.value)} className="w-full min-h-[200px] border border-slate-300 rounded-lg p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white transition-colors" placeholder="请粘贴旧版简历文本..."/>)}
                </div>
              </>
            ) : (
              <>
                <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200">
                  <h3 className="text-[15px] font-bold text-slate-800 flex items-center"><PenTool className="w-4 h-4 mr-2 text-indigo-600"/> 2. 基础信息与经历 <span className="text-rose-500 ml-1">*</span></h3>
                </div>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-medium text-slate-600 mb-1">工作年限 <span className="text-rose-500">*</span></label><select value={scratchData.yearsExp} onChange={e => setScratchData({...scratchData, yearsExp: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white"><option value="">请选择</option><option value="应届生">应届生</option><option value="1-3年">1-3年</option><option value="3-5年">3-5年</option><option value="5-10年">5-10年</option><option value="10年以上">10年以上</option></select></div>
                    <div><label className="block text-xs font-medium text-slate-600 mb-1">当前/最近岗位 <span className="text-rose-500">*</span></label><input type="text" value={scratchData.currentRole} onChange={e => setScratchData({...scratchData, currentRole: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white" placeholder="例如：运营专员"/></div>
                    <div><label className="block text-xs font-medium text-slate-600 mb-1">最高学历 <span className="text-slate-400 font-normal ml-1">可选</span></label><input type="text" value={scratchData.education} onChange={e => setScratchData({...scratchData, education: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white" placeholder="例如：本科"/></div>
                    <div><label className="block text-xs font-medium text-slate-600 mb-1">技能与工具 <span className="text-slate-400 font-normal ml-1">可选</span></label><input type="text" value={scratchData.skills} onChange={e => setScratchData({...scratchData, skills: e.target.value})} className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white" placeholder="例如：Excel, SQL, Python"/></div>
                  </div>
                  <div>
                    <div className="flex justify-between items-end mb-2"><h4 className="text-sm font-bold text-slate-800">工作经历线索 <span className="text-rose-500">*</span></h4></div>
                    <div className="bg-indigo-50/60 border border-indigo-100 p-3 rounded-lg mb-3"><p className="text-xs text-indigo-800 font-medium">不用写正式简历，想到什么写什么。AI 会帮你整理成专业表达。</p></div>
                    <textarea value={scratchData.workSnippet} onChange={e => setScratchData({...scratchData, workSnippet: e.target.value})} className="w-full min-h-[100px] border border-slate-300 rounded-lg p-3 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-colors" placeholder="例如：我之前在某公司做用户运营，主要负责社群的日常维护和活跃，策划过节假日活动..."/>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 mb-2">项目经历线索 <span className="text-slate-400 font-normal ml-1">可选</span></h4>
                    <p className="text-xs text-slate-500 mb-2">没有项目也可以跳过；<strong className="text-slate-700">如果有项目名称或结果数据，简历质量会明显更好。</strong></p>
                    <textarea value={scratchData.projectSnippet} onChange={e => setScratchData({...scratchData, projectSnippet: e.target.value})} className="w-full min-h-[80px] border border-slate-300 rounded-lg p-3 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-colors" placeholder="例如：参与过618大促，负责分层策略，订单增长18%..."/>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 mt-2">
                    <div className="flex items-center"><FileBadge className="w-4 h-4 text-slate-400 mr-2"/><span className="text-xs text-slate-600">不想手写？也可以直接上传工作总结、复盘材料，AI 会帮你提炼经历。</span></div>
                    <button onClick={() => { setActiveSection('materials'); document.getElementById('materials-section').scrollIntoView({behavior: 'smooth'}) }} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">去上传</button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div id="materials-section" className="bg-white rounded-xl shadow-[0_4px_20px_rgba(79,70,229,0.08)] border border-indigo-100 overflow-hidden relative group" onMouseEnter={() => setActiveSection('materials')}>
            <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg tracking-wider">提升亮点必备</div>
            <div className="bg-indigo-50/50 px-6 py-4 border-b border-indigo-100 flex items-center">
              <Briefcase className="w-4 h-4 mr-2 text-indigo-600"/> <h3 className="text-[15px] font-bold text-slate-800">3. 补充资料 <span className="text-xs text-slate-500 ml-1 font-medium">(可选)</span></h3>
            </div>
            <div className="p-6">
              <UploadDropzone title="拖拽或点击上传项目文档、总结复盘" description="支持多文件。AI 将从中提取项目背景与数据成果" large accent onPick={() => handleFileUpload(setMaterials)} onDropFiles={(files) => processUploadFiles(files, setMaterials)} />
              {materials.length > 0 && <div className="mt-4"><FileList files={materials} onRemove={(idx) => setMaterials(materials.filter((_, i) => i !== idx))} onPreview={setPreviewFile} /></div>}
            </div>
          </div>

          <div className="pt-4">
            <button onClick={handleGenerate} disabled={!isReady || isProcessing} className={`w-full py-4 rounded-xl font-bold text-[15px] transition-all flex items-center justify-center shadow-lg ${isReady && !isProcessing ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
              {isProcessing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Sparkles className="w-5 h-5 mr-2" />}
              {isProcessing ? 'AI 正在处理...' : (mode === 'optimize' ? '开始分析并优化简历' : '开始生成简历初稿')}
            </button>
          </div>
        </div>
      </div>

      <div className="w-[300px] bg-white border-l border-slate-200 shrink-0 hidden md:flex flex-col z-10 shadow-[-2px_0_8px_rgba(0,0,0,0.02)] mt-10">
        <div className="p-5 border-b border-slate-200 bg-slate-50/50">
          <h3 className="text-[13px] font-bold text-slate-800 flex items-center mb-4"><CheckCircle className="w-4 h-4 mr-1.5 text-indigo-600"/> {mode === 'optimize' ? '当前资料完整度' : '当前已提供资料'}</h3>
          <div className="flex justify-between items-end mb-1.5">
            <span className="text-xl font-black text-indigo-600 leading-none">
              {mode === 'optimize' ? `${completeness}%` : `${checklist.filter(i => i.done).length}/${checklist.length}`}
            </span>
          </div>
          {mode === 'optimize' && (
            <div className="w-full bg-slate-200 rounded-full h-1.5 mb-4 overflow-hidden"><div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${completeness}%` }}></div></div>
          )}
          {mode === 'scratch' && !isReady && (
            <p className="text-xs text-indigo-600 font-medium mb-3">还差 {requiredItems.length - doneRequiredCount} 个必填项即可生成初稿</p>
          )}
          <div className="space-y-1.5">
            {checklist.map(item => (
              <div key={item.key} className="flex items-center justify-between text-[11px] py-1">
                <div className="flex items-center">
                  {item.done ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mr-2" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300 mr-2 flex items-center justify-center">{item.required && <div className="w-1.5 h-1.5 bg-rose-400 rounded-full"></div>}</div>}
                  <span className={item.done ? 'text-slate-700' : (item.required ? 'text-rose-600 font-medium' : 'text-slate-500')}>
                    {item.done ? `已提供${item.label}` : `缺少${item.label}`}
                  </span>
                </div>
                {item.bonus && !item.done && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[9px] font-bold">加分项</span>}
                {item.required && !item.done && <span className="text-rose-500 text-[9px] font-bold">必填</span>}
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200">
            <p className="text-[10px] text-slate-500 flex items-start"><Info className="w-3.5 h-3.5 mr-1 shrink-0"/> 上传补充资料(项目文档等)可大幅提升 AI 提炼的生成质量。</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-50/30">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">AI 将帮你生成</h3>
          <ul className="text-xs text-slate-600 space-y-3 pl-1">
            {mode === 'optimize' ? (
              <>
                <li className="flex items-center"><Check className="w-3.5 h-3.5 text-indigo-500 mr-2"/> JD 匹配度诊断</li>
                <li className="flex items-center"><Check className="w-3.5 h-3.5 text-indigo-500 mr-2"/> 简历问题识别</li>
                <li className="flex items-center"><Check className="w-3.5 h-3.5 text-indigo-500 mr-2"/> 过度包装风险提示</li>
                <li className="flex items-center"><Check className="w-3.5 h-3.5 text-indigo-500 mr-2"/> 局部改写建议</li>
                <li className="flex items-center"><Check className="w-3.5 h-3.5 text-indigo-500 mr-2"/> 面试追问预测</li>
              </>
            ) : (
              <>
                <li className="flex items-center"><Check className="w-3.5 h-3.5 text-indigo-500 mr-2"/> 结构化个人优势</li>
                <li className="flex items-center"><Check className="w-3.5 h-3.5 text-indigo-500 mr-2"/> STAR 法则工作经历</li>
                <li className="flex items-center"><Check className="w-3.5 h-3.5 text-indigo-500 mr-2"/> 高亮点项目经历</li>
                <li className="flex items-center"><Check className="w-3.5 h-3.5 text-indigo-500 mr-2"/> 专业技能总结</li>
                <li className="flex items-center"><Check className="w-3.5 h-3.5 text-indigo-500 mr-2"/> 面试追问预测</li>
              </>
            )}
          </ul>
        </div>
      </div>

      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPreviewFile(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col m-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center">
                <FileText className="w-5 h-5 text-indigo-500 mr-2"/>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{previewFile.name}</h3>
                  <p className="text-[11px] text-slate-400">{previewFile.size}</p>
                </div>
              </div>
              <button onClick={() => setPreviewFile(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5"/>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {previewFile.status === 'error' ? (
                <div className="flex items-start p-4 bg-rose-50 border border-rose-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mr-2 mt-0.5"/>
                  <div>
                    <p className="text-sm font-medium text-rose-700">解析失败</p>
                    <p className="text-xs text-rose-500 mt-1">{previewFile.error || '未知错误'}</p>
                  </div>
                </div>
              ) : (
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {previewFile.text || '(未能提取到文本内容)'}
                </pre>
              )}
            </div>
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/50 rounded-b-xl">
              <p className="text-[10px] text-slate-400">
                AI 将基于此解析内容进行简历生成和分析
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
