import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, MessageSquare, Users, Users2,
  Megaphone, Bot, Clock, LogOut, ChevronLeft, ChevronRight, Zap, Filter, Send, Wand2, CalendarClock
} from 'lucide-react';

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/whatsapp', icon: MessageSquare, label: 'WhatsApp' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/filter', icon: Filter, label: 'Number Filter' },
  { to: '/groups', icon: Users2, label: 'Group Grabber' },
  { to: '/bulk', icon: Send, label: 'Bulk Sender' },
  { to: '/personalize', icon: Wand2, label: 'Personalize' },
  { to: '/campaigns', icon: Megaphone, label: 'Campaigns' },
  { to: '/autoreply', icon: Bot, label: 'Auto Reply' },
  { to: '/schedule', icon: Clock, label: 'Schedule' },
  { isDivider: true, label: 'MULTIPLE SETUP' },
  { to: '/group-automation', icon: CalendarClock, label: 'Group Automation' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? 72 : 230,
        background: 'var(--bg2)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.22s ease',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding: collapsed ? '20px 0' : '20px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #c084fc)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Zap size={18} color="#fff" fill="#fff" />
          </div>
          {!collapsed && <span style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 17, background: 'linear-gradient(135deg, #c084fc, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Sender Pro</span>}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto' }}>
          {nav.map((item, i) => {
            if (item.isDivider) {
              return !collapsed ? (
                <div key={i} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginTop: 15, marginBottom: 5, paddingLeft: 14, letterSpacing: '0.05em' }}>
                  {item.label}
                </div>
              ) : <div key={i} style={{ height: 15 }} />;
            }

            const { to, icon: Icon, label } = item;
            return (
              <NavLink key={to} to={to} style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 11,
                padding: collapsed ? '10px 0' : '10px 14px',
                borderRadius: 10, marginBottom: 3, textDecoration: 'none',
                justifyContent: collapsed ? 'center' : 'flex-start',
                color: isActive ? '#c084fc' : 'var(--text3)',
                background: isActive ? 'rgba(124,58,237,0.12)' : 'transparent',
                fontWeight: isActive ? 600 : 400,
                fontSize: 13.5,
                transition: 'all 0.15s',
              })}>
                <Icon size={17} />
                {!collapsed && label}
              </NavLink>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div style={{ padding: collapsed ? '14px 0' : '14px 14px', borderTop: '1px solid var(--border)' }}>
          {!collapsed && (
            <div style={{ marginBottom: 10, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
            </div>
          )}
          <button onClick={handleLogout} className="btn btn-danger" style={{ width: '100%', justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '9px 0' : undefined }}>
            <LogOut size={15} />
            {!collapsed && 'Logout'}
          </button>
        </div>

        {/* Collapse toggle */}
        <button onClick={() => setCollapsed(c => !c)} style={{
          position: 'absolute', top: 24, right: -12,
          width: 24, height: 24, borderRadius: '50%',
          background: 'var(--card)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text2)', zIndex: 10,
        }}>
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg)', padding: '28px 32px' }}>
        <Outlet />
      </main>
    </div>
  );
}
