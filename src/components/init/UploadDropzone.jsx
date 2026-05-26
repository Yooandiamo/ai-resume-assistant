import React, { useState } from 'react';
import { ChevronDown, Loader2, UploadCloud, FileBadge, FileUp, FileText, X, AlertCircle, Eye } from 'lucide-react';

export const SUPPORTED_FILE_HINT = "支持 PDF、Word(.docx)、TXT、Markdown、PNG、JPG、WEBP，单个文件不超过 15MB";
export const ACCEPTED_UPLOAD_TYPES = '.pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,text/plain,application/pdf,image/png,image/jpeg,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function UploadDropzone({ title, description, onPick, onDropFiles, className = "", large = false, accent = false, icon = "file" }) {
  const [isDragging, setIsDragging] = useState(false);
  const Icon = icon === "upload" ? UploadCloud : (accent ? FileBadge : FileUp);

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    onDropFiles(Array.from(event.dataTransfer.files || []));
  };

  return (
    <div
      onClick={onPick}
      onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
      onDragOver={(event) => { event.preventDefault(); }}
      onDragLeave={(event) => { event.preventDefault(); setIsDragging(false); }}
      onDrop={handleDrop}
      className={`${className} border-2 border-dashed rounded-lg cursor-pointer flex flex-col items-center justify-center text-center transition-colors ${large ? 'py-10 px-5' : 'p-4'} ${accent ? 'border-indigo-200 bg-white hover:bg-indigo-50' : 'border-slate-300 bg-slate-50 hover:bg-indigo-50'} ${isDragging ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100' : ''}`}
    >
      <Icon className={`${large ? 'w-6 h-6' : 'w-5 h-5'} text-indigo-500 mb-2`} />
      <p className={`${large ? 'text-sm font-bold' : 'text-xs font-medium'} text-slate-700`}>{title}</p>
      <p className="text-[11px] text-slate-400 mt-1">{description || SUPPORTED_FILE_HINT}</p>
    </div>
  );
}

export function FileList({ files, onRemove, onPreview }) {
  return (
    <div className="space-y-2 mt-3">
      {files.map((file, idx) => (
        <div key={idx} className={`flex items-center justify-between p-2.5 rounded-lg shadow-sm border ${file.status === 'error' ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center overflow-hidden flex-1 min-w-0"
               onClick={() => file.status === 'ready' && onPreview?.(file)}
               title={file.status === 'ready' ? '点击预览解析内容' : ''}>
            {file.status === 'parsing' ? <Loader2 className="w-4 h-4 text-indigo-500 shrink-0 mr-2 animate-spin"/> :
             file.status === 'error' ? <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mr-2"/> :
             <FileText className="w-4 h-4 text-indigo-500 shrink-0 mr-2"/>}
            <span className="text-xs font-medium text-slate-700 truncate">{file.name || '未命名文件'}</span>
            {file.status === 'parsing' && <span className="ml-2 text-[10px] text-indigo-500 shrink-0">解析中</span>}
            {file.status === 'ready' && <span className="ml-2 text-[10px] text-emerald-500 shrink-0">{file.size}</span>}
            {file.status === 'error' && <span className="ml-2 text-[10px] text-rose-500 shrink-0" title={file.error || '解析失败'}>{file.error || '解析失败'}</span>}
          </div>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {file.status === 'ready' && onPreview && (
              <button onClick={() => onPreview(file)} className="text-slate-400 hover:text-indigo-500 p-1" title="预览内容">
                <Eye className="w-3.5 h-3.5"/>
              </button>
            )}
            <button onClick={() => onRemove(idx)} className="text-slate-400 hover:text-rose-500 p-1"><X className="w-3.5 h-3.5"/></button>
          </div>
        </div>
      ))}
    </div>
  );
}
