import React, { useState, useEffect, useRef } from 'react';
import { FileText, Sparkles, FileEdit, PenTool, ChevronRight, Clock, Loader2, Package, AlertCircle, Plus, Trash2, UploadCloud } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { ACCEPTED_UPLOAD_TYPES } from '../init/UploadDropzone';

const STATUS_LABEL = {
  generating: { text: '生成中', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  ready: { text: '已完成', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed: { text: '失败', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  draft: { text: '草稿', cls: 'bg-slate-50 text-slate-600 border-slate-200' }
};

const CATEGORY_LABEL = {
  jd: { text: 'JD', cls: 'bg-blue-50 text-blue-600' },
  resume: { text: '简历', cls: 'bg-emerald-50 text-emerald-600' },
  material: { text: '资料', cls: 'bg-amber-50 text-amber-600' }
};

export function DesktopDashboard() {
  const { handleStartProject, handleLoadProject } = useProject();
  const [tab, setTab] = useState('new');
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // 资料库上传状态
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const fileInputRef = useRef(null);

  const loadProjects = () => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => setProjects(data.projects || []))
      .catch(() => {})
      .finally(() => setLoadingProjects(false));
  };

  useEffect(() => { loadProjects(); }, []);

  const recentProjects = projects.filter(p => p.status === 'ready').slice(0, 10);

  const allMaterials = projects.flatMap(p => {
    const mats = p.materials || { files: [], combinedText: '' };
    const files = mats.files || [];
    return files.map(f => ({ ...f, projectTitle: p.title, projectId: p.id }));
  });

  const handleDeleteProject = async (e, project) => {
    e.stopPropagation();
    setDeleteConfirm(project.id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await fetch(`/api/projects/${deleteConfirm}`, { method: 'DELETE' });
      setProjects(prev => prev.filter(p => p.id !== deleteConfirm));
    } catch {
      alert('删除失败，请重试');
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  // 资料库上传
  const handleLibUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleLibFilesSelected = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;
    setIsUploading(true);

    try {
      const formData = new FormData();
      selectedFiles.forEach(file => formData.append('files', file, file.name));
      const parseRes = await fetch('/api/files/parse', { method: 'POST', body: formData });
      const parseData = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseData?.error || '文件解析失败');

      const parsedFiles = parseData.files.map((file, idx) => ({
        name: file.name || selectedFiles[idx]?.name,
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        text: file.text || '',
        status: file.status === 'error' ? 'error' : 'ready',
        error: file.error || undefined,
        category: 'material'
      }));

      const combinedText = parsedFiles
        .filter(f => f.status === 'ready')
        .map(f => `【${f.name}】\n${f.text || ''}`)
        .join('\n\n');

      // 创建资料库项目
      const today = new Date().toLocaleDateString('zh-CN');
      const createRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `资料库素材 - ${today}`,
          status: 'draft',
          materials: { files: parsedFiles, combinedText }
        })
      });
      if (createRes.ok) {
        setUploadedFiles(parsedFiles);
        loadProjects(); // 刷新列表
      }
    } catch (err) {
      alert(err.message || '上传失败');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDropFiles = async (files) => {
    if (!files.length) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file, file.name));
      const parseRes = await fetch('/api/files/parse', { method: 'POST', body: formData });
      const parseData = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseData?.error || '文件解析失败');

      const parsedFiles = parseData.files.map((file, idx) => ({
        name: file.name || files[idx]?.name,
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        text: file.text || '',
        status: file.status === 'error' ? 'error' : 'ready',
        error: file.error || undefined,
        category: 'material'
      }));

      const combinedText = parsedFiles
        .filter(f => f.status === 'ready')
        .map(f => `【${f.name}】\n${f.text || ''}`)
        .join('\n\n');

      const today = new Date().toLocaleDateString('zh-CN');
      const createRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `资料库素材 - ${today}`,
          status: 'draft',
          materials: { files: parsedFiles, combinedText }
        })
      });
      if (createRes.ok) {
        setUploadedFiles(parsedFiles);
        loadProjects();
      }
    } catch (err) {
      alert(err.message || '上传失败');
    } finally {
      setIsUploading(false);
    }
  };

  const headerContent = {
    new: { title: '新建简历任务', desc: '选择一种方式开始构建您的求职材料' },
    history: { title: '历史记录', desc: '查看和继续编辑之前的简历任务' },
    materials: { title: '资料库', desc: '所有项目中上传的文件和资料汇总' }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8 lg:p-12">
      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm m-4">
            <h3 className="text-lg font-bold text-slate-800 mb-2">确认删除</h3>
            <p className="text-sm text-slate-600 mb-6">删除后将无法恢复，确定要删除这个项目吗？</p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">取消</button>
              <button onClick={confirmDelete} disabled={deleting} className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center">
                {deleting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto animate-fade-in">
        <header className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{headerContent[tab].title}</h1>
            <p className="text-slate-500 mt-2 text-sm">{headerContent[tab].desc}</p>
          </div>
        </header>

        {/* Tab bar */}
        <div className="flex items-center border-b border-slate-200 mb-6">
          <button onClick={() => setTab('new')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === 'new' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Plus className="w-4 h-4 inline mr-1.5" />新建任务
          </button>
          <button onClick={() => setTab('history')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Clock className="w-4 h-4 inline mr-1.5" />历史记录
          </button>
          <button onClick={() => setTab('materials')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === 'materials' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Package className="w-4 h-4 inline mr-1.5" />资料库
            {allMaterials.length > 0 && <span className="ml-1.5 bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-full">{allMaterials.length}</span>}
          </button>
        </div>

        {/* Tab content */}
        {tab === 'new' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div onClick={() => handleStartProject('optimize')} className="group bg-white border border-slate-200 rounded-xl p-6 cursor-pointer hover:border-indigo-500 hover:shadow-lg transition-all flex items-start">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0 mr-5 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <FileEdit className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">我有简历，按 JD 优化</h3>
                  <p className="text-slate-500 text-sm leading-relaxed mb-4 min-h-[60px]">
                    输入现有简历和目标岗位描述 (JD)，AI 将分析匹配度差异，并逐句重写经历描述，消除过度包装风险。
                  </p>
                  <span className="text-indigo-600 text-sm font-medium flex items-center">创建优化任务 <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" /></span>
                </div>
              </div>

              <div onClick={() => handleStartProject('scratch')} className="group bg-white border border-slate-200 rounded-xl p-6 cursor-pointer hover:border-emerald-500 hover:shadow-lg transition-all flex items-start">
                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shrink-0 mr-5 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <PenTool className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">我没有简历，从零生成</h3>
                  <p className="text-slate-500 text-sm leading-relaxed mb-4 min-h-[60px]">
                    填写基础信息和零散经历，AI 通过追问补全内容；也可上传项目文档辅助提炼亮点，生成结构完整初稿。
                  </p>
                  <span className="text-emerald-600 text-sm font-medium flex items-center">开启全新创作 <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" /></span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => handleStartProject('demo')}>
              <Sparkles className="w-5 h-5 text-amber-500 mr-3" />
              <div>
                <span className="text-sm font-medium text-slate-700">演示体验：B端产品运营专家</span>
                <span className="text-xs text-slate-400 ml-2">— 快速了解 AI 简历优化能力</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div>
            {loadingProjects ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                <Loader2 className="w-6 h-6 text-slate-400 animate-spin mx-auto mb-2" />
                <p className="text-sm text-slate-400">加载历史记录...</p>
              </div>
            ) : recentProjects.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                <Clock className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500 mb-1">暂无历史记录</p>
                <p className="text-xs text-slate-400">创建第一个简历任务后，记录将显示在这里</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="grid grid-cols-[minmax(260px,1.35fr)_minmax(180px,1fr)_120px_140px_220px] bg-slate-50 px-8 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <div>简历名称</div>
                  <div>目标岗位</div>
                  <div className="text-center">状态</div>
                  <div className="text-center">更新时间</div>
                  <div className="text-center">操作</div>
                </div>
                <div className="divide-y divide-slate-100 text-sm text-slate-700">
                  {recentProjects.map(project => (
                    <div key={project.id} className="grid grid-cols-[minmax(260px,1.35fr)_minmax(180px,1fr)_120px_140px_220px] items-center px-8 py-5 hover:bg-slate-50 transition-colors">
                      <button className="min-w-0 text-left font-medium" onClick={() => handleLoadProject(project)}>
                        <span className="flex items-center min-w-0">
                          <FileText className="w-4 h-4 text-indigo-500 mr-3 shrink-0" />
                          <span className="truncate">{project.title || '未命名简历'}</span>
                        </span>
                      </button>
                      <button className="min-w-0 text-left text-slate-500 truncate" onClick={() => handleLoadProject(project)}>
                        {project.resume?.targetRole || '-'}
                      </button>
                      <button className="text-center" onClick={() => handleLoadProject(project)}>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${(STATUS_LABEL[project.status] || STATUS_LABEL.draft).cls}`}>
                          {(STATUS_LABEL[project.status] || STATUS_LABEL.draft).text}
                        </span>
                      </button>
                      <button className="text-center text-slate-400 text-xs" onClick={() => handleLoadProject(project)}>
                        {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString('zh-CN') : '-'}
                      </button>
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); handleLoadProject(project); }} className="h-8 px-3 rounded-md bg-indigo-50 text-indigo-700 font-medium text-xs hover:bg-indigo-100 transition-colors">
                          继续编辑
                        </button>
                        <button onClick={(e) => handleDeleteProject(e, project)} className="h-8 px-2.5 rounded-md border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-colors flex items-center text-xs font-medium" title="删除项目">
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'materials' && (
          <div>
            {/* 上传区域 */}
            <div className="mb-6">
              <input type="file" ref={fileInputRef} className="hidden" multiple accept={ACCEPTED_UPLOAD_TYPES} onChange={handleLibFilesSelected} />
              <div
                onClick={handleLibUploadClick}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-indigo-400', 'bg-indigo-50/50'); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-50/50'); }}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-50/50'); handleDropFiles(Array.from(e.dataTransfer.files)); }}
                className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all"
              >
                {isUploading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
                    <p className="text-sm font-medium text-slate-600">正在解析文件...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
                    <p className="text-sm font-medium text-slate-600">拖拽文件到此处，或点击上传</p>
                    <p className="text-xs text-slate-400 mt-1">支持 PDF、Word、TXT、Markdown、图片，单个文件不超过 15MB</p>
                  </div>
                )}
              </div>
              {uploadedFiles.length > 0 && (
                <div className="mt-3 flex items-center text-emerald-600 text-xs">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5" />已上传 {uploadedFiles.length} 个文件到资料库
                </div>
              )}
            </div>

            {loadingProjects ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                <Loader2 className="w-6 h-6 text-slate-400 animate-spin mx-auto mb-2" />
                <p className="text-sm text-slate-400">加载资料库...</p>
              </div>
            ) : allMaterials.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                <Package className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500 mb-1">暂无上传资料</p>
                <p className="text-xs text-slate-400">创建简历任务并上传资料后，文件将显示在这里。也可以直接在上方上传资料。</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-medium">文件名</th>
                      <th className="px-6 py-4 font-medium">类别</th>
                      <th className="px-6 py-4 font-medium">大小</th>
                      <th className="px-6 py-4 font-medium">状态</th>
                      <th className="px-6 py-4 font-medium">所属项目</th>
                      <th className="px-6 py-4 font-medium text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {allMaterials.map((file, idx) => (
                      <tr key={`${file.projectId}-${idx}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium">
                          <div className="flex items-center">
                            <FileText className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                            <span className="truncate max-w-[180px]">{file.name || '未知文件'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${(CATEGORY_LABEL[file.category] || CATEGORY_LABEL.material).cls}`}>
                            {(CATEGORY_LABEL[file.category] || CATEGORY_LABEL.material).text}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-xs">{file.size || '-'}</td>
                        <td className="px-6 py-4">
                          {file.status === 'ready' ? (
                            <span className="inline-flex items-center text-emerald-600 text-xs"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5" />已解析</span>
                          ) : file.status === 'error' ? (
                            <span className="inline-flex items-center text-rose-500 text-xs"><AlertCircle className="w-3 h-3 mr-1" />解析失败</span>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs truncate max-w-[120px]">{file.projectTitle || '-'}</td>
                        <td className="px-6 py-4 text-right">
                          {file.projectId && (
                            <button onClick={() => {
                              const project = projects.find(p => p.id === file.projectId);
                              if (project) handleLoadProject(project);
                            }} className="text-indigo-600 font-medium text-xs hover:text-indigo-800">
                              查看项目
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
