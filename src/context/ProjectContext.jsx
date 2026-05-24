import React, { createContext, useContext, useState } from 'react';

const ProjectContext = createContext(null);

const initialProjectData = {
  jd: "",
  title: "未命名简历",
  resume: {
    name: "张三", contact: "13800000000 | zhangsan@email.com", targetRole: "未填写",
    summary: [], work: [], projects: []
  },
  analysis: null
};

export function ProjectProvider({ children }) {
  const [currentView, setCurrentView] = useState('dashboard');
  const [initMode, setInitMode] = useState('optimize');
  const [projectData, setProjectData] = useState(initialProjectData);

  const handleStartProject = (mode) => {
    setInitMode(mode);
    setCurrentView('init');
  };

  const handleLoadProject = (project) => {
    const materials = project.materials || { files: [], combinedText: '' };
    setProjectData({
      id: project.id,
      mode: project.mode || 'optimize',
      jd: project.jd || '',
      title: project.title || '未命名简历',
      resume: project.resume || { name: '', contact: '', targetRole: '', summary: [], work: [], projects: [] },
      analysis: project.analysis,
      _status: 'ready',
      _materialsText: materials.combinedText || '',
      _materialsFiles: materials.files || []
    });
    setCurrentView('workspace');
  };

  const resetProjectState = () => {
    setProjectData(initialProjectData);
    setInitMode('optimize');
    setCurrentView('dashboard');
  };

  return (
    <ProjectContext.Provider value={{
      currentView, setCurrentView,
      initMode, setInitMode,
      projectData, setProjectData,
      handleStartProject, handleLoadProject,
      resetProjectState
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
