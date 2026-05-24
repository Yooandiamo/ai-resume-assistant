import React from 'react';

export function NavItem({ icon, active, onClick, label }) {
  return (
    <div onClick={onClick} className={`w-full flex justify-center py-3 cursor-pointer transition-colors relative group ${active ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}>
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full"></div>}
      {React.cloneElement(icon, { className: 'w-5 h-5' })}
      <div className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
        {label}
      </div>
    </div>
  );
}
