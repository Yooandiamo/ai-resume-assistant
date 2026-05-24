import React from 'react';
import { MiniNav } from './components/layout/MiniNav';
import { DesktopDashboard } from './components/dashboard/DesktopDashboard';
import { InitFlowView } from './components/init/InitFlowView';
import { DesktopWorkspace } from './components/workspace/DesktopWorkspace';
import { useProject } from './context/ProjectContext';
import { useAuth } from './context/AuthContext';
import { AuthView } from './components/auth/AuthView';
import { Loader2 } from 'lucide-react';

export default function App() {
  const { currentView } = useProject();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        正在检查登录状态...
      </div>
    );
  }

  if (!user) return <AuthView />;

  return (
    <div className="flex h-screen w-full bg-[#F5F5F5] text-slate-800 font-sans overflow-hidden">
      <MiniNav />
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        {currentView === 'dashboard' && <DesktopDashboard />}
        {currentView === 'init' && <InitFlowView />}
        {currentView === 'workspace' && <DesktopWorkspace />}
      </main>
    </div>
  );
}
