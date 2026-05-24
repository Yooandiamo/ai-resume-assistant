import React from 'react';
import { LogOut, Sparkles, LayoutDashboard, FileText, Settings } from 'lucide-react';
import { NavItem } from '../shared/NavItem';
import { useProject } from '../../context/ProjectContext';
import { useAuth } from '../../context/AuthContext';

export function MiniNav() {
  const { currentView, setCurrentView, projectData, resetProjectState } = useProject();
  const { user, logout } = useAuth();
  const hasCurrentTask = Boolean(projectData?.id || projectData?._status === 'generating');
  const initials = (user?.name || user?.email || '?').slice(0, 1).toUpperCase();
  const handleLogout = async () => {
    resetProjectState();
    await logout();
  };

  return (
    <nav className="w-16 flex flex-col items-center py-4 bg-slate-900 border-r border-slate-800 z-20 shrink-0">
      <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white mb-8 shadow-lg">
        <Sparkles className="w-6 h-6" />
      </div>
      <div className="flex flex-col space-y-4 flex-1 w-full">
        <NavItem icon={<LayoutDashboard />} label="工作台" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
        <NavItem icon={<FileText />} label="当前任务" active={currentView === 'workspace' || currentView === 'init'} onClick={() => setCurrentView(hasCurrentTask ? 'workspace' : 'dashboard')} />
      </div>
      <div className="flex flex-col space-y-4 w-full mt-auto">
        <NavItem icon={<Settings />} label="设置" />
        <button onClick={handleLogout} title="退出登录" className="w-8 h-8 rounded-full bg-slate-700 mx-auto border border-slate-600 mt-2 text-slate-200 text-xs font-bold hover:bg-slate-600 transition-colors">
          {initials}
        </button>
        <button onClick={handleLogout} title="退出登录" className="w-8 h-8 rounded-lg mx-auto text-slate-500 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}
