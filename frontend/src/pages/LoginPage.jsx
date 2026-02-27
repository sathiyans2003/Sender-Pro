import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Zap, Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // login | register | forgot
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login, register, forgotPassword } = useAuth();
  const navigate = useNavigate();

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
        navigate('/dashboard');
      } else if (mode === 'register') {
        await register(form.name, form.email, form.password);
        navigate('/dashboard');
      } else if (mode === 'forgot') {
        const data = await forgotPassword(form.email);
        toast.success(data?.message || 'Reset link ready');
        setMode('login');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      {/* Background orbs */}
      <div style={{ position: 'absolute', top: '10%', left: '10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(192,132,252,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Left panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#7c3aed,#c084fc)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={22} color="#fff" fill="#fff" />
            </div>
            <span style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 22, background: 'linear-gradient(135deg,#c084fc,#7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Sender Pro</span>
          </div>

          {/* Heading */}
          <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 30, fontWeight: 800, marginBottom: 8 }}>
            {mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create account' : 'Reset password'}
          </h1>
          <p style={{ color: 'var(--text3)', marginBottom: 32 }}>
            {mode === 'login' ? 'Sign in to manage your campaigns' : mode === 'register' ? 'Start sending messages at scale' : 'Enter your email to get a reset link'}
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="form-group">
                <label className="label">Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                  <input className="input" style={{ paddingLeft: 36 }} placeholder="John Doe" value={form.name} onChange={e => update('name', e.target.value)} required />
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="label">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input className="input" style={{ paddingLeft: 36 }} type="email" placeholder="you@example.com" value={form.email} onChange={e => update('email', e.target.value)} required />
              </div>
            </div>
            {mode !== 'forgot' && (
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="label" style={{ marginBottom: 0 }}>Password</label>
                  {mode === 'login' && (
                    <button type="button" onClick={() => setMode('forgot')} style={{ background: 'none', border: 'none', color: 'var(--accent3)', fontSize: 13, cursor: 'pointer', padding: 0 }}>
                      Forgot password?
                    </button>
                  )}
                </div>
                <div style={{ position: 'relative', marginTop: 8 }}>
                  <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                  <input className="input" style={{ paddingLeft: 36, paddingRight: 40 }} type={showPassword ? "text" : "password"} placeholder="••••••••" value={form.password} onChange={e => update('password', e.target.value)} required minLength={6} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 8, fontSize: 15 }} disabled={loading}>
              {loading ? 'Please wait...' : (mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link')}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 24, color: 'var(--text3)', fontSize: 13 }}>
            {mode === 'login' ? "Don't have an account? " : mode === 'register' ? 'Already have an account? ' : 'Remember your password? '}
            <button type="button" onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}
              style={{ color: 'var(--accent3)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              {mode === 'login' ? 'Register' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>

      {/* Right panel (hidden on small) */}
      <div style={{ flex: 1, background: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(192,132,252,0.05) 100%)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ maxWidth: 360, textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>🚀</div>
          <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 26, fontWeight: 800, marginBottom: 16, lineHeight: 1.3 }}>
            WhatsApp Marketing<br />Made Simple
          </h2>
          <p style={{ color: 'var(--text3)', lineHeight: 1.7 }}>
            Send bulk messages, auto-reply to customers, grab group contacts, and schedule campaigns — all from one powerful dashboard.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 32, flexWrap: 'wrap' }}>
            {['Bulk Messaging', 'Auto Reply', 'Group Grabber', 'Scheduler'].map(f => (
              <span key={f} className="badge badge-purple">{f}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
