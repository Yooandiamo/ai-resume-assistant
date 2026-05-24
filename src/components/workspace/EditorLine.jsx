import React, { useState, useEffect } from 'react';

export function EditorLine({ text, path, isSelected, onSelect, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [localText, setLocalText] = useState(text);
  useEffect(() => { setLocalText(text); }, [text]);
  const handleBlur = () => { setIsEditing(false); if (localText.trim() !== text) onUpdate(path, localText); };

  if (isEditing) {
    return (<li className="relative rounded px-1 -ml-1 flex my-1"><textarea value={localText} onChange={(e) => setLocalText(e.target.value)} onBlur={handleBlur} className="w-full bg-white border border-indigo-400 rounded outline-none p-1 text-sm shadow-sm resize-none" rows={Math.max(1, Math.ceil(localText.length / 50))} autoFocus/></li>);
  }
  return (
    <li className="relative group/line hover:bg-slate-50 rounded px-1 -ml-1 transition-colors">
      <span onClick={() => onSelect(path)} onDoubleClick={() => setIsEditing(true)} className={`cursor-pointer transition-colors px-0.5 rounded ${isSelected ? 'bg-indigo-100/70 border-b-2 border-indigo-300' : 'border-b-2 border-transparent'}`}>{text}</span>
    </li>
  );
}
