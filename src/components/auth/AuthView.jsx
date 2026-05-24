import React, { useState } from 'react';
import { Loader2, LockKeyhole, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function AuthView() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === 'register';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isRegister) await register(form);
      else await login(form);
    } catch (err) {
      setError(err.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-sm p-8">
        <div className="flex items-center mb-8">
          <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center text-white mr-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">AI 简历助手</h1>
            <p className="text-sm text-slate-500">登录后继续管理你的简历项目</p>
          </div>
        </div>

        <div className="grid grid-cols-2 bg-slate-100 rounded-lg p-1 mb-6">
          <button type="button" onClick={() => setMode('login')} className={`h-9 rounded-md text-sm font-medium transition-colors ${!isRegister ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            登录
          </button>
          <button type="button" onClick={() => setMode('register')} className={`h-9 rounded-md text-sm font-medium transition-colors ${isRegister ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            注册
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <label className="block">
              <span className="text-xs font-medium text-slate-600">姓名</span>
              <input
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1 w-full h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="用于区分你的账号"
              />
            </label>
          )}
          <label className="block">
            <span className="text-xs font-medium text-slate-600">邮箱</span>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
              className="mt-1 w-full h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="you@example.com"
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">密码</span>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
              className="mt-1 w-full h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="至少 8 位"
              minLength={8}
              required
            />
          </label>

          {error && <div className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2 text-xs text-rose-600">{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LockKeyhole className="w-4 h-4 mr-2" />}
            {submitting ? '处理中...' : isRegister ? '创建账号并进入' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}
