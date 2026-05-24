import React from 'react';

export function ShortcutBtn({ onClick, icon, text, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className="w-full text-left px-3 py-2 bg-white border border-slate-200 hover:bg-indigo-50 rounded-lg text-xs text-slate-700 shadow-sm flex items-center">
      <span className="flex items-center">{React.cloneElement(icon, { className: 'w-3.5 h-3.5 mr-2 text-indigo-500' })} {text}</span>
    </button>
  );
}
