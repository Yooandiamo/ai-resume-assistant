import React, { useState } from 'react';
import { Edit3, X, Target, Sparkles, Loader2 } from 'lucide-react';
import { ShortcutBtn } from '../shared/ShortcutBtn';

export function LocalRewritePanel({ selectedPath, jd, onUpdateText, onClear }) {
  const [isRewriting, setIsRewriting] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  const handleRewrite = async (instruction) => {
    if (!selectedPath) return;
    setIsRewriting(true);
    try {
      const response = await fetch('/api/resume/rewrite-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd, text: selectedPath.text, instruction })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '改写失败');
      if (data && data.rewritten_text) { onUpdateText(selectedPath, data.rewritten_text); setCustomPrompt(""); }
    } catch (error) { alert("改写失败"); } finally { setIsRewriting(false); }
  };

  if (!selectedPath) return (<div className="flex flex-col items-center justify-center h-48 text-center text-slate-400 mt-10"><Edit3 className="w-8 h-8 mb-3 opacity-20" /><p className="text-sm">点击选中单条句子<br/>唤起局部润色对话</p></div>);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">修改指定段落<button onClick={onClear} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button></div>
      <div className="bg-indigo-50 border border-indigo-100 p-2.5 rounded-lg text-[11px] text-slate-700 mb-4 shadow-inner relative"><span className="font-semibold text-indigo-700">原文：</span>{selectedPath.text}{isRewriting && (<div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center rounded-lg"><Loader2 className="w-5 h-5 text-indigo-600 animate-spin" /></div>)}</div>
      <div className="space-y-2 flex-1">
        <ShortcutBtn onClick={() => handleRewrite("贴合JD要求")} icon={<Target/>} text="更贴合目标 JD" disabled={isRewriting} />
        <ShortcutBtn onClick={() => handleRewrite("增加数据感")} icon={<Sparkles/>} text="更有数据感" disabled={isRewriting} />
      </div>
    </div>
  );
}
