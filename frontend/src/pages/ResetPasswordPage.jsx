import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Zap, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { resetPassword } = useAuth();
    const navigate = useNavigate();
    const { token } = useParams();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            return toast.error('Passwords do not match');
        }
        setLoading(true);
        try {
            const data = await resetPassword(token, password);
            toast.success(data?.message || 'Password updated successfully');
            navigate('/login');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                <div style={{ width: '100%', maxWidth: 400 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#7c3aed,#c084fc)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Zap size={22} color="#fff" fill="#fff" />
                        </div>
                        <span style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 22, background: 'linear-gradient(135deg,#c084fc,#7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Sender Pro</span>
                    </div>

                    <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 30, fontWeight: 800, marginBottom: 8 }}>Set New Password</h1>
                    <p style={{ color: 'var(--text3)', marginBottom: 32 }}>Enter your new password below.</p>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="label">New Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                                <input className="input" style={{ paddingLeft: 36, paddingRight: 40 }} type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="label">Confirm Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                                <input className="input" style={{ paddingLeft: 36, paddingRight: 40 }} type={showConfirmPassword ? "text" : "password"} placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} />
                                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 8, fontSize: 15 }} disabled={loading}>
                            {loading ? 'Please wait...' : 'Update Password'}
                            {!loading && <ArrowRight size={16} />}
                        </button>
                    </form>
                    <p style={{ textAlign: 'center', marginTop: 24, color: 'var(--text3)', fontSize: 13 }}>
                        <button onClick={() => navigate('/login')} style={{ color: 'var(--accent3)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                            Back to Sign In
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
                </div>
            </div>
        </div>
    );
}
