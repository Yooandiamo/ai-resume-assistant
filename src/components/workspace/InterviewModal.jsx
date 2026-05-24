import React from 'react';
import { BrainCircuit, X, Loader2, MessageSquare } from 'lucide-react';

export function InterviewModal({ show, interviewData, isGenerating, onClose }) {
  if (!show) return null;

  return (
    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden relative">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-white">
          <div><h2 className="text-xl font-bold text-slate-900 flex items-center"><BrainCircuit className="w-6 h-6 mr-2 text-indigo-600" /> 面试追问预测</h2></div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 border border-slate-200"><X className="w-5 h-5"/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center h-64 text-indigo-600">
              <Loader2 className="w-10 h-10 animate-spin mb-4" />
              <p className="font-medium text-slate-700">正在生成面试题...</p>
            </div>
          ) : interviewData?.questions && (
            <div className="space-y-6">
              {interviewData.questions.map((q, idx) => (
                <div key={idx} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h3 className="font-bold text-slate-800 text-base mb-3 flex items-start"><span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs mr-2 mt-0.5">Q{idx + 1}</span> {q.question}</h3>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 mt-4">
                    <p className="text-xs font-bold text-emerald-800 mb-1 flex items-center"><MessageSquare className="w-3.5 h-3.5 mr-1" /> 回答建议</p>
                    <p className="text-[13px] text-emerald-700/80 leading-relaxed whitespace-pre-wrap">{q.suggestion}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
