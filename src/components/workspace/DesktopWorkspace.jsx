import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Target, CheckSquare, Loader2, Sparkles, BrainCircuit,
  Download, Zap, MessageSquare, AlertTriangle, Navigation,
  CheckCircle, HelpCircle, Send, FileText, Undo2
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { ResumeBlock } from './ResumeBlock';
import { EditorLine } from './EditorLine';
import { LocalRewritePanel } from './LocalRewritePanel';
import { InterviewModal } from './InterviewModal';

export function DesktopWorkspace() {
  const { projectData, setProjectData } = useProject();
  const [leftTab, setLeftTab] = useState('jd');
  const [rightTab, setRightTab] = useState('copilot');
  const [selectedPath, setSelectedPath] = useState(null);
  const [highlightTarget, setHighlightTarget] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [optimizingItem, setOptimizingItem] = useState(null);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [interviewData, setInterviewData] = useState(null);
  const [isGeneratingInterview, setIsGeneratingInterview] = useState(false);
  const [materialFacts, setMaterialFacts] = useState(null);
  const [isExtractingFacts, setIsExtractingFacts] = useState(false);
  const [factsSource, setFactsSource] = useState('current'); // 'current' | 'library'
  const [undoDepth, setUndoDepth] = useState(0);
  const undoStackRef = useRef([]);
  const fieldEditSnapshotRef = useRef(null);

  const handleExtractFacts = async (source = 'current') => {
    if (isExtractingFacts) return;
    setIsExtractingFacts(true);
    setFactsSource(source);
    try {
      let materialsText = '';
      if (source === 'current') {
        materialsText = projectData._materialsText;
      } else {
        // 从资料库获取所有项目资料
        const res = await fetch('/api/projects');
        const data = await res.json();
        const allProjects = data.projects || [];
        materialsText = allProjects
          .map(p => {
            const mats = p.materials || {};
            return mats.combinedText || '';
          })
          .filter(Boolean)
          .join('\n\n');
      }
      if (!materialsText) {
        setMaterialFacts([]);
        setLeftTab('materials');
        return;
      }
      const response = await fetch('/api/resume/extract-facts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialsText, existingResume: resume })
      });
      const data = await response.json();
      if (response.ok && data.facts) {
        setMaterialFacts(data.facts);
        setLeftTab('materials');
      }
    } catch {
      // silently fail
    } finally {
      setIsExtractingFacts(false);
    }
  };

  const resume = projectData.resume;
  const analysisRanRef = useRef(false);
  const mountedRef = useRef(false);

  const cloneResume = useCallback((resumeValue) => (
    JSON.parse(JSON.stringify(resumeValue || { name: '', contact: '', targetRole: '', summary: [], work: [], projects: [] }))
  ), []);

  const pushUndoSnapshot = useCallback((source, label = '修改') => {
    if (!source?.resume || source._status === 'generating') return;
    const snapshot = {
      label,
      title: source.title,
      resume: cloneResume(source.resume),
      analysis: source.analysis ?? null
    };
    const stack = undoStackRef.current;
    const last = stack[stack.length - 1];
    if (last && last.title === snapshot.title && JSON.stringify(last.resume) === JSON.stringify(snapshot.resume)) return;
    stack.push(snapshot);
    if (stack.length > 30) stack.shift();
    setUndoDepth(stack.length);
  }, [cloneResume]);

  const beginFieldEdit = useCallback(() => {
    fieldEditSnapshotRef.current = {
      title: projectData.title,
      resume: cloneResume(projectData.resume),
      analysis: projectData.analysis ?? null
    };
  }, [cloneResume, projectData.analysis, projectData.resume, projectData.title]);

  const commitFieldEdit = useCallback((label) => {
    const snapshot = fieldEditSnapshotRef.current;
    if (!snapshot) return;
    const changed = snapshot.title !== projectData.title ||
      JSON.stringify(snapshot.resume) !== JSON.stringify(projectData.resume);
    if (changed) pushUndoSnapshot(snapshot, label);
    fieldEditSnapshotRef.current = null;
  }, [projectData.resume, projectData.title, pushUndoSnapshot]);

  const handleUndo = useCallback(() => {
    const snapshot = undoStackRef.current.pop();
    if (!snapshot) return;
    fieldEditSnapshotRef.current = null;
    setUndoDepth(undoStackRef.current.length);
    setSelectedPath(null);
    setProjectData(prev => ({
      ...prev,
      title: snapshot.title ?? prev.title,
      resume: cloneResume(snapshot.resume),
      analysis: snapshot.analysis
    }));
  }, [cloneResume, setProjectData]);

  useEffect(() => {
    const handler = (event) => {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.key.toLowerCase() !== 'z') return;
      const active = document.activeElement;
      const tagName = active?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || active?.isContentEditable) return;
      if (undoStackRef.current.length === 0 || projectData._status === 'generating') return;
      event.preventDefault();
      handleUndo();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, projectData._status]);

  useEffect(() => {
    if (isAnalyzing) return;
    // 等待异步生成完成后再跑分析
    if (projectData._status === 'generating') return;
    // 已有分析且不是 placeholder resume，不重复跑
    if (projectData.analysis && analysisRanRef.current) return;
    // 如果是 placeholder resume（work/projects 为空），等真实数据
    if (resume.work?.length === 0 && resume.projects?.length === 0 && projectData._status !== 'ready') return;
    analysisRanRef.current = true;
    const timer = setTimeout(() => runGlobalAnalysis(), 800);
    return () => clearTimeout(timer);
  }, [projectData.analysis, isAnalyzing, projectData._status, resume]);

  useEffect(() => {
    if (!projectData.id || !mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/projects/${projectData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: projectData.title,
          jd: projectData.jd,
          resume: projectData.resume,
          analysis: projectData.analysis,
          materials: { files: projectData._materialsFiles || [], combinedText: projectData._materialsText || '' }
        })
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [projectData]);

  // 异步生成轮询
  useEffect(() => {
    if (projectData._status !== 'generating' || !projectData._asyncProjectId) return;
    let cancelled = false;
    const timers = new Set();
    const schedule = (fn, delay) => {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, delay);
      timers.add(id);
    };
    const poll = async () => {
      try {
        const response = await fetch(`/api/projects/${projectData._asyncProjectId}`);
        const data = await response.json();
        if (cancelled) return;
        const proj = data.project;
        if (proj.status === 'ready' && proj.resume) {
          analysisRanRef.current = false;
          setProjectData(prev => ({
            ...prev,
            id: prev.id || proj.id, // 确保项目 ID 已设置，用于后续自动保存
            resume: proj.resume,
            analysis: null,
            title: prev.title === '简历生成中...' ? `${proj.resume.name || '未命名'}_初稿` : prev.title,
            _status: 'ready',
            _asyncProjectId: undefined
          }));
        } else if (proj.status === 'failed') {
          setProjectData(prev => ({
            ...prev,
            _status: 'failed',
            _error: proj.error || '生成失败'
          }));
        } else {
          if (!cancelled) schedule(poll, 2000);
        }
      } catch {
        if (!cancelled) schedule(poll, 3000);
      }
    };
    schedule(poll, 1500);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [projectData._status, projectData._asyncProjectId]);

  const runGlobalAnalysis = async () => {
    setIsAnalyzing(true);
    const controller = new AbortController();
    try {
      const response = await fetch('/api/resume/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd: projectData.jd, resume }),
        signal: controller.signal
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '诊断失败');
      setProjectData(prev => ({ ...prev, analysis: data.analysis }));
    } catch (error) {
      if (error.name === 'AbortError') return;
      setProjectData(prev => ({ ...prev, analysis: { score: 65, preference: "待完善JD信息以获取深度分析", skills: ["沟通"], risks: [], missing: [] } }));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleOptimizeItem = async (type, index = null) => {
    const itemKey = `${type}-${index !== null ? index : 'all'}`;
    setOptimizingItem(itemKey);
    try {
      let bullets = [];
      let contextDesc = "";
      if (type === 'summary') { bullets = resume.summary; contextDesc = "求职者的个人优势总结"; }
      else if (type === 'work') { bullets = resume.work[index].bullets; contextDesc = `${resume.work[index].company}经历`; }
      else if (type === 'projects') { bullets = resume.projects[index].bullets; contextDesc = `${resume.projects[index].name}项目经历`; }

      const response = await fetch('/api/resume/rewrite-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd: projectData.jd, bullets, contextDesc })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '改写失败');

      if (data && data.bullets) {
        pushUndoSnapshot(projectData, `AI 优化${contextDesc}`);
        setProjectData(prev => {
          const newResume = JSON.parse(JSON.stringify(prev.resume));
          if (type === 'summary') newResume.summary = data.bullets;
          else if (type === 'work') newResume.work[index].bullets = data.bullets;
          else if (type === 'projects') newResume.projects[index].bullets = data.bullets;
          return { ...prev, resume: newResume };
        });
      }
    } catch (error) {
      alert("优化失败");
    } finally {
      setOptimizingItem(null);
    }
  };

  const handleOpenInterviewPrep = async () => {
    setShowInterviewModal(true);
    if (interviewData) return;
    setIsGeneratingInterview(true);
    try {
      const response = await fetch('/api/resume/interview-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd: projectData.jd, resume })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '面试问题生成失败');
      setInterviewData(data);
    } catch {
      setShowInterviewModal(false);
    } finally {
      setIsGeneratingInterview(false);
    }
  };

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const exportBtnRef = useRef(null);
  const exportMenuRef = useRef(null);

  // 点击外部关闭导出菜单
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target) &&
          exportBtnRef.current && !exportBtnRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  const handleCopyResume = async () => {
    setShowExportMenu(false);
    try {
      const response = await fetch('/api/resume/export/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume })
      });
      const text = await response.text();
      await navigator.clipboard.writeText(text);
      alert('已复制简历文本');
    } catch {
      alert('复制失败，请稍后重试');
    }
  };

  const handleDownload = async (format) => {
    setShowExportMenu(false);
    try {
      const response = await fetch(`/api/resume/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume })
      });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extMap = { markdown: '.md', docx: '.docx', pdf: '.pdf', text: '.txt' };
      const ext = extMap[format] || '.txt';
      a.download = (resume.name || 'resume') + ext;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('下载失败，请稍后重试');
    }
  };

  const handleSelectBullet = (path) => { setSelectedPath(path); setRightTab('chat'); };
  const handleUpdateResumeText = (path, newText) => {
    pushUndoSnapshot(projectData, '正文编辑');
    setProjectData(prev => {
      const newResume = JSON.parse(JSON.stringify(prev.resume));
      if (path.section === 'summary') newResume.summary[path.bulletIndex] = newText;
      else if (path.section === 'work') newResume.work[path.index].bullets[path.bulletIndex] = newText;
      else if (path.section === 'projects') newResume.projects[path.index].bullets[path.bulletIndex] = newText;
      return { ...prev, resume: newResume };
    });
  };

  const handleFollowUpUpdate = (updatedResume) => {
    pushUndoSnapshot(projectData, '追问补充');
    analysisRanRef.current = false;
    setProjectData(prev => ({ ...prev, resume: updatedResume, analysis: null }));
  };

  useEffect(() => {
    if (highlightTarget) { const timer = setTimeout(() => setHighlightTarget(null), 2500); return () => clearTimeout(timer); }
  }, [highlightTarget]);

  return (
    <div className="flex flex-col h-full w-full relative">
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-20 shadow-sm">
        <div className="flex items-center">
          <input
            value={projectData.title}
            onFocus={beginFieldEdit}
            onBlur={() => commitFieldEdit('标题编辑')}
            onChange={(e) => setProjectData({...projectData, title: e.target.value})}
            className="text-slate-800 font-medium text-sm mr-2 outline-none w-64"
          />
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleUndo}
            disabled={undoDepth === 0 || projectData._status === 'generating'}
            title={undoDepth > 0 ? `撤回上一步：${undoStackRef.current[undoDepth - 1]?.label || '修改'}` : '暂无可撤回修改'}
            className={`flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              undoDepth === 0 || projectData._status === 'generating'
                ? 'text-slate-400 bg-slate-50 cursor-not-allowed'
                : 'text-slate-700 bg-slate-100 hover:bg-slate-200'
            }`}
          >
            <Undo2 className="w-4 h-4 mr-1.5" /> 撤回
          </button>
          <div className="relative">
            <button ref={exportBtnRef} onClick={() => {
              if (!showExportMenu && exportBtnRef.current) {
                const rect = exportBtnRef.current.getBoundingClientRect();
                setDropdownPos({ top: rect.bottom + 4, left: rect.right - 176 });
              }
              setShowExportMenu(!showExportMenu);
            }} className="flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"><Download className="w-4 h-4 mr-1.5" /> 导出 / 复制</button>
            {showExportMenu && (
              <div ref={exportMenuRef} className="fixed w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1" style={{ top: dropdownPos.top, left: dropdownPos.left }}>
                <button onClick={handleCopyResume} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center"><Download className="w-3.5 h-3.5 mr-2 text-slate-400"/> 复制文本到剪贴板</button>
                <button onClick={() => handleDownload('text')} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center"><Download className="w-3.5 h-3.5 mr-2 text-slate-400"/> 下载 TXT 文件</button>
                <button onClick={() => handleDownload('markdown')} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center"><Download className="w-3.5 h-3.5 mr-2 text-indigo-400"/> 下载 Markdown 文件</button>
                <button onClick={() => handleDownload('docx')} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center"><Download className="w-3.5 h-3.5 mr-2 text-blue-400"/> 下载 Word 文件</button>
                <button onClick={() => handleDownload('pdf')} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center"><Download className="w-3.5 h-3.5 mr-2 text-rose-400"/> 下载 PDF 文件</button>
              </div>
            )}
          </div>
          <button onClick={handleOpenInterviewPrep} className="flex items-center px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md"><BrainCircuit className="w-4 h-4 mr-1.5" /> 面试追问预测</button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden bg-white">
        {/* Left Panel */}
        <div className="w-[320px] bg-white flex flex-col shrink-0 border-r border-slate-200 shadow-[2px_0_8px_rgba(0,0,0,0.02)] z-10">
          <div className="flex text-xs font-medium border-b border-slate-200 bg-slate-50/50">
            <button onClick={() => setLeftTab('jd')} className={`flex-1 py-2.5 flex items-center justify-center transition-colors ${leftTab === 'jd' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}><Target className="w-3.5 h-3.5 mr-1" /> JD 解析</button>
            <button onClick={() => setLeftTab('materials')} className={`flex-1 py-2.5 flex items-center justify-center transition-colors ${leftTab === 'materials' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}><FileText className="w-3.5 h-3.5 mr-1" /> 资料来源</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {leftTab === 'jd' && (
              <>
                {projectData.analysis && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center text-slate-700 text-xs font-bold mb-1.5"><CheckSquare className="w-3.5 h-3.5 mr-1 text-indigo-500"/> AI 洞察隐性偏好</div>
                    <p className="text-xs text-slate-600 leading-relaxed">{projectData.analysis.preference}</p>
                  </div>
                )}
                {isAnalyzing && <div className="text-xs text-slate-500 flex items-center mt-4"><Loader2 className="w-3 h-3 animate-spin mr-1"/> 正在分析 JD...</div>}
              </>
            )}
            {leftTab === 'materials' && (
              <>
                {!materialFacts && !isExtractingFacts && (
                  <div className="text-center py-8">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-3"/>
                    <p className="text-xs text-slate-500 mb-4">从上传的补充资料中提取关键事实，帮助你验证简历内容的来源。</p>
                    <div className="space-y-2">
                      <button onClick={() => handleExtractFacts('current')} className="w-full px-4 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                        提取当前项目资料事实
                      </button>
                      <button onClick={() => handleExtractFacts('library')} className="w-full px-4 py-2 bg-white border border-indigo-200 text-indigo-600 text-xs font-medium rounded-lg hover:bg-indigo-50 transition-colors">
                        从资料库提取全部资料
                      </button>
                    </div>
                  </div>
                )}
                {isExtractingFacts && (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3"/>
                    <p className="text-xs text-slate-500">AI 正在从{ factsSource === 'library' ? '资料库' : '当前项目资料' }中提取关键事实...</p>
                  </div>
                )}
                {materialFacts && materialFacts.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-600">
                        提取到 {materialFacts.length} 条事实
                        <span className="ml-1 text-[10px] font-normal text-slate-400">({ factsSource === 'library' ? '资料库' : '当前项目' })</span>
                      </span>
                      <div className="flex items-center space-x-2">
                        <button onClick={() => handleExtractFacts('current')} disabled={isExtractingFacts} className="text-[10px] text-slate-500 hover:text-indigo-600 font-medium">当前项目</button>
                        <button onClick={() => handleExtractFacts('library')} disabled={isExtractingFacts} className="text-[10px] text-slate-500 hover:text-indigo-600 font-medium">资料库</button>
                      </div>
                    </div>
                    {materialFacts.map((fact, idx) => (
                      <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3 hover:border-indigo-200 transition-colors">
                        <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">{fact.category}</span>
                        <p className="text-xs text-slate-700 mt-1.5 leading-relaxed">{fact.fact}</p>
                        {fact.source && <p className="text-[10px] text-slate-400 mt-1.5 flex items-center"><FileText className="w-3 h-3 mr-1"/> {fact.source}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {materialFacts && materialFacts.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-xs text-slate-400">未从资料中提取到可用事实。</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Center Editor */}
        <div className="flex-1 overflow-y-auto relative flex justify-center py-10 px-4 custom-scrollbar bg-white" onClick={() => setSelectedPath(null)}>
          <div className="w-full max-w-[820px] min-h-[calc(100vh-8rem)] p-12 lg:p-16 relative" onClick={(e) => e.stopPropagation()}>
            {projectData._status === 'generating' && (
              <div className="absolute inset-0 bg-white/90 z-30 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                <p className="text-lg font-bold text-slate-800 mb-1">AI 正在分析资料并生成简历</p>
                <p className="text-sm text-slate-500">正在理解你的 JD 和经历，预计需要 10-30 秒</p>
              </div>
            )}
            {projectData._status === 'failed' && (
              <div className="absolute inset-0 bg-white/90 z-30 flex flex-col items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-rose-500 mb-4" />
                <p className="text-lg font-bold text-slate-800 mb-1">生成失败</p>
                <p className="text-sm text-slate-500 mb-4">{projectData._error || '请稍后重试'}</p>
                <button onClick={async () => {
                  setProjectData(prev => ({ ...prev, _status: 'generating', _error: undefined }));
                  try {
                    const materialFiles = projectData._materialsFiles || [];
                    const response = await fetch('/api/resume/generate-async', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        projectId: projectData.id,
                        jd: projectData.jd,
                        resumeText: projectData._originalResumeText || '',
                        materialsText: projectData._materialsText || '',
                        jdFiles: materialFiles.filter(f => f.category === 'jd'),
                        resumeFiles: materialFiles.filter(f => f.category === 'resume'),
                        materialsFiles: materialFiles.filter(f => !f.category || f.category === 'material'),
                        mode: projectData.mode || 'optimize'
                      })
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data?.error || '重新生成失败');
                    setProjectData(prev => ({
                      ...prev,
                      id: data.project?.id || prev.id,
                      _asyncProjectId: data.project?.id || prev.id,
                      _status: 'generating',
                      _error: undefined
                    }));
                  } catch (error) {
                    setProjectData(prev => ({ ...prev, _status: 'failed', _error: error.message || '重新生成失败' }));
                  }
                }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">重新生成</button>
              </div>
            )}
            <div className="border-b border-slate-200 pb-5 mb-8">
              <input
                value={resume.name}
                onFocus={beginFieldEdit}
                onBlur={() => commitFieldEdit('姓名编辑')}
                onChange={(e) => setProjectData({...projectData, resume: {...resume, name: e.target.value}})}
                className="text-3xl font-bold text-slate-900 mb-1 outline-none w-full"
              />
              <input
                value={resume.targetRole}
                onFocus={beginFieldEdit}
                onBlur={() => commitFieldEdit('目标岗位编辑')}
                onChange={(e) => setProjectData({...projectData, resume: {...resume, targetRole: e.target.value}})}
                className="text-sm text-slate-600 outline-none w-full"
              />
            </div>

            <ResumeBlock title="个人优势" onOptimize={() => handleOptimizeItem('summary')} isOptimizing={optimizingItem === 'summary-all'}>
              <ul className="list-disc pl-5 space-y-2 text-sm text-slate-800 leading-relaxed">
                {resume.summary.map((text, idx) => <EditorLine key={idx} text={text} path={{section: 'summary', bulletIndex: idx, text}} isSelected={selectedPath?.section === 'summary' && selectedPath?.bulletIndex === idx} onSelect={handleSelectBullet} onUpdate={handleUpdateResumeText} />)}
              </ul>
            </ResumeBlock>

            <ResumeBlock title="工作经历">
              {resume.work.map((w, wIdx) => (
                <div key={wIdx} className="mb-6 group/block p-3 -mx-3 rounded-lg hover:bg-slate-50 transition-colors relative">
                  <div className="flex justify-between font-bold text-slate-900 text-[15px] mb-0.5">
                    <span>{w.company}</span>
                    <div className="flex items-center space-x-3">
                      <button onClick={() => handleOptimizeItem('work', wIdx)} className="text-[10px] text-indigo-600 flex items-center bg-white border border-indigo-100 hover:bg-indigo-50 px-2 py-1 rounded">
                        <Zap className="w-3 h-3 mr-1"/> 一键优化
                      </button>
                    </div>
                  </div>
                  <div className="relative mt-3">
                    {optimizingItem === `work-${wIdx}` && <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 rounded"></div>}
                    <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-700 leading-relaxed">
                      {w.bullets.map((text, bIdx) => <EditorLine key={bIdx} text={text} path={{section: 'work', index: wIdx, bulletIndex: bIdx, text}} isSelected={selectedPath?.section === 'work' && selectedPath?.index === wIdx && selectedPath?.bulletIndex === bIdx} onSelect={handleSelectBullet} onUpdate={handleUpdateResumeText} />)}
                    </ul>
                  </div>
                </div>
              ))}
            </ResumeBlock>

            <ResumeBlock title="项目经历">
              {resume.projects.map((p, pIdx) => (
                <div key={pIdx} className="mb-4 relative rounded-lg hover:bg-slate-50">
                  <div className="p-3 -mx-3">
                    <div className="flex justify-between font-bold text-slate-900 text-[15px] mb-0.5">
                      <span>{p.name}</span>
                      <button onClick={() => handleOptimizeItem('projects', pIdx)} className="text-[10px] text-indigo-600 flex items-center bg-white border border-indigo-100 px-2 py-1 rounded"><Zap className="w-3 h-3 mr-1"/>一键优化</button>
                    </div>
                    <div className="relative mt-3">
                      {optimizingItem === `projects-${pIdx}` && <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 rounded"></div>}
                      <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-700 leading-relaxed">
                        {p.bullets.map((text, bIdx) => <EditorLine key={bIdx} text={text} path={{section: 'projects', index: pIdx, bulletIndex: bIdx, text}} isSelected={selectedPath?.section === 'projects' && selectedPath?.index === pIdx && selectedPath?.bulletIndex === bIdx} onSelect={handleSelectBullet} onUpdate={handleUpdateResumeText} />)}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </ResumeBlock>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-[340px] bg-white flex flex-col shrink-0 border-l border-slate-200 z-10 shadow-[-2px_0_8px_rgba(0,0,0,0.02)]">
          <div className="flex text-xs font-medium border-b border-slate-200 bg-slate-50/50">
            <button onClick={() => { setRightTab('copilot'); setSelectedPath(null); }} className={`flex-1 py-2.5 flex items-center justify-center ${rightTab === 'copilot' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-100'}`}><Sparkles className="w-3.5 h-3.5 mr-1" /> AI 诊断大盘</button>
            <button onClick={() => setRightTab('chat')} className={`flex-1 py-2.5 flex items-center justify-center ${rightTab === 'chat' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-100'}`}><MessageSquare className="w-3.5 h-3.5 mr-1" /> 局部改写 {selectedPath && <span className="w-2 h-2 rounded-full bg-indigo-500 ml-1"></span>}</button>
          </div>
          <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4">
            {rightTab === 'copilot' && projectData.analysis && (
              <div className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">
                    核心待办任务 <span className="ml-1 bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full text-[10px]">{projectData.analysis.risks.length + projectData.analysis.missing.length}</span>
                  </h3>
                  <div className="flex gap-2 mb-2">
                    {projectData.analysis.risks.length > 0 && <span className="bg-rose-50 border border-rose-100 text-rose-700 px-2 py-1 rounded text-[10px] flex items-center"><AlertTriangle className="w-3 h-3 mr-1"/>包装风险 {projectData.analysis.risks.length}</span>}
                    {projectData.analysis.missing.length > 0 && <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-1 rounded text-[10px] flex items-center"><MessageSquare className="w-3 h-3 mr-1"/>信息缺失 {projectData.analysis.missing.length}</span>}
                  </div>
                </div>

                <div className="space-y-3">
                  {projectData.analysis.risks.map((risk, idx) => (
                    <div key={`risk-${idx}`} className="bg-white border border-rose-200 rounded-xl shadow-sm overflow-hidden">
                      <div className="bg-rose-50 px-3 py-2 flex items-center justify-between border-b border-rose-100">
                        <div className="flex items-center text-rose-700 text-xs font-bold"><AlertTriangle className="w-3.5 h-3.5 mr-1.5"/> 包装预警</div>
                        <button onClick={() => { const pIdx = resume.projects.findIndex(p => p.bullets.some(b => b.includes(risk.quote) || risk.quote.includes(b.substring(0,10)))); if(pIdx >= 0) setHighlightTarget(`project-${pIdx}`); }} className="text-[10px] text-rose-600 font-medium hover:bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200 flex items-center transition-colors"><Navigation className="w-2.5 h-2.5 mr-1 transform rotate-45"/> 定位原文</button>
                      </div>
                      <div className="p-3">
                        <p className="text-[11px] text-slate-600 leading-relaxed mb-3">原文存在：<strong className="text-rose-600 font-medium mx-0.5">{risk.quote}</strong>。{risk.reason}</p>
                      </div>
                    </div>
                  ))}

                  {/* 信息缺失追问区域 */}
                  {projectData.analysis.missing.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-700 flex items-center"><HelpCircle className="w-3.5 h-3.5 mr-1 text-indigo-500"/> 补充信息可提升简历质量</h4>
                      {projectData.analysis.missing.map((item, idx) => (
                        <MissingInfoCard key={`missing-${idx}`} item={item} idx={idx} jd={projectData.jd} resume={resume} onUpdateResume={handleFollowUpUpdate} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            {rightTab === 'chat' && <LocalRewritePanel selectedPath={selectedPath} jd={projectData.jd} onUpdateText={handleUpdateResumeText} onClear={() => setSelectedPath(null)} />}
          </div>
        </div>
      </div>

      <InterviewModal
        show={showInterviewModal}
        interviewData={interviewData}
        isGenerating={isGeneratingInterview}
        onClose={() => setShowInterviewModal(false)}
      />
    </div>
  );
}

// 信息缺失追问卡片
function MissingInfoCard({ item, idx, jd, resume, onUpdateResume }) {
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleSubmit = async () => {
    if (!answer.trim()) return;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/resume/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jd,
          resume,
          topic: item.topic,
          question: item.prompt,
          answer: answer.trim()
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '补充信息失败');
      if (data.resume) {
        onUpdateResume(data.resume);
      }
      setIsDone(true);
    } catch (error) {
      alert(error.message || '补充信息失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isDone) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
        <div className="flex items-center text-emerald-700 text-xs font-bold"><CheckCircle className="w-3.5 h-3.5 mr-1"/> 已补充：{item.topic}</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-indigo-200 rounded-xl shadow-sm overflow-hidden">
      <div className="bg-indigo-50 px-3 py-2 flex items-center border-b border-indigo-100">
        <div className="flex items-center text-indigo-700 text-xs font-bold"><HelpCircle className="w-3.5 h-3.5 mr-1.5"/> 需要补充：{item.topic}</div>
      </div>
      <div className="p-3 space-y-2">
        <p className="text-[11px] text-slate-600 leading-relaxed">{item.prompt}</p>
        <textarea
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          placeholder="在此输入补充信息..."
          className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none resize-none bg-white min-h-[60px]"
          disabled={isSubmitting}
        />
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !answer.trim()}
          className={`w-full py-1.5 rounded-lg text-xs font-medium flex items-center justify-center transition-colors ${isSubmitting || !answer.trim() ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
        >
          {isSubmitting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
          {isSubmitting ? 'AI 正在整合...' : '提交补充，AI 优化简历'}
        </button>
      </div>
    </div>
  );
}
