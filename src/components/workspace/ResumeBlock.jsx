import React from 'react';

export function ResumeBlock({ title, children, onOptimize, isOptimizing }) {
  return (
    <div className="mb-8 group/section relative">
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-2 mb-4">
        <input defaultValue={title} className="text-lg font-bold text-slate-900 outline-none w-1/2" />
        {onOptimize && (
          <div className="hidden group-hover/section:flex space-x-2">
            <button onClick={onOptimize} disabled={isOptimizing} className="text-[10px] font-medium text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm flex items-center transition-colors">
              {isOptimizing ? 'AI 重写中...' : 'AI 一键优化本段'}
            </button>
          </div>
        )}
      </div>
      <div className="relative">
        {isOptimizing && <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 rounded"></div>}
        {children}
      </div>
    </div>
  );
}
