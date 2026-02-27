import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Users, Megaphone, Send, Bot, Clock, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, color = 'var(--accent)' }) => (
  <div className="stat-card fade-in" style={{ '--accent': color }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <div style={{ color: 'var(--text3)', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: 30, fontWeight: 800, color: 'var(--text)' }}>{value ?? '—'}</div>
      </div>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} color={color} />
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  const { user }          = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setL]   = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(r => setStats(r.data))
      .finally(() => setL(false));
  }, []);

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 26, fontWeight: 800 }}>
          Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p style={{ color: 'var(--text3)', marginTop: 4 }}>Here's your messaging overview</p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text3)' }}>Loading stats...</p>
      ) : (
        <>
          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            <StatCard icon={Users}      label="Total Contacts"   value={stats?.contacts}   color="#7c3aed" />
            <StatCard icon={Megaphone}  label="Campaigns"        value={stats?.campaigns}  color="#0ea5e9" />
            <StatCard icon={Send}       label="Messages Sent"    value={stats?.totalSent}  color="#22c55e" />
            <StatCard icon={AlertCircle}label="Failed"           value={stats?.totalFailed}color="#ef4444" />
            <StatCard icon={TrendingUp} label="Running Now"      value={stats?.running}    color="#f59e0b" />
            <StatCard icon={CheckCircle}label="Completed"        value={stats?.completed}  color="#22c55e" />
            <StatCard icon={Bot}        label="Active Auto-Reply" value={stats?.autoreplies}color="#c084fc" />
            <StatCard icon={Clock}      label="Active Schedules"  value={stats?.schedules}  color="#06b6d4" />
          </div>

          {/* Quick tips */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Quick Start</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {[
                { step: '1', title: 'Connect WhatsApp', desc: 'Scan QR code to connect your account', path: '/whatsapp' },
                { step: '2', title: 'Add Contacts',     desc: 'Import or manually add phone numbers', path: '/contacts' },
                { step: '3', title: 'Create Campaign',  desc: 'Compose and send bulk messages',       path: '/campaigns' },
              ].map(s => (
                <a href={s.path} key={s.step} style={{ textDecoration: 'none', display: 'block', padding: '16px', background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(124,58,237,0.2)', color: 'var(--accent3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, marginBottom: 10 }}>{s.step}</div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{s.title}</div>
                  <div style={{ color: 'var(--text3)', fontSize: 12 }}>{s.desc}</div>
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
