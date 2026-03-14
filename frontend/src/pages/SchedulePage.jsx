import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Clock, Trash2, X } from 'lucide-react';

const PRESETS = [
  { label: 'Every day at 9am', cron: '0 9 * * *' },
  { label: 'Every day at 6pm', cron: '0 18 * * *' },
  { label: 'Every Monday 9am', cron: '0 9 * * 1' },
  { label: 'Every hour', cron: '0 * * * *' },
  { label: 'Every 30 minutes', cron: '*/30 * * * *' },
  { label: 'Every day at noon', cron: '0 12 * * *' },
];

export default function SchedulePage() {
  const [schedules, setSchedules] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: '', message: '', cronExpr: '0 9 * * *',
    phones: '', group: '', isRecurring: false, scheduledAt: ''
  });

  const load = async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([api.get('/schedule'), api.get('/contacts')]);
      setSchedules(s.data);
      setContacts(c.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const createSchedule = async (e) => {
    e.preventDefault();
    let phoneList = [];
    if (form.phones.trim()) {
      phoneList = form.phones.split(/[\n,]/).map(p => p.trim()).filter(Boolean);
    } else if (form.group) {
      phoneList = contacts.filter(c => c.group === form.group).map(c => c.phone);
    } else {
      phoneList = contacts.map(c => c.phone);
    }
    if (!phoneList.length) return toast.error('No contacts selected');
    try {
      const { data } = await api.post('/schedule', {
        ...form,
        contacts: phoneList
      });
      setSchedules(s => [data, ...s]);
      setShowNew(false);
      setForm({ name: '', message: '', cronExpr: '0 9 * * *', phones: '', group: '', isRecurring: false, scheduledAt: '' });
      toast.success('Schedule created!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const toggle = async (id) => {
    const { data } = await api.patch(`/schedule/${id}/toggle`);
    setSchedules(s => s.map(x => x.id === id ? data : x));
    toast.success(data.active ? 'Activated' : 'Deactivated');
  };

  const deleteSchedule = async (id) => {
    await api.delete(`/schedule/${id}`);
    setSchedules(s => s.filter(x => x.id !== id));
    toast.success('Deleted');
  };

  const groups = [...new Set(contacts.map(c => c.group))];

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Schedule</div>
          <div className="page-sub">Auto-send messages at set times</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> New Schedule</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading...</div>
      ) : schedules.length === 0 ? (
        <div className="empty-state card">
          <Clock size={48} />
          <h3>No Schedules</h3>
          <p>Create scheduled message campaigns</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {schedules.map(s => (
            <div key={s.id} className="card" style={{ opacity: s.active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: s.active ? 'rgba(34,197,94,0.12)' : 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Clock size={18} color={s.active ? 'var(--green)' : 'var(--text3)'} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15 }}>{s.name}</span>
                    <span className={`badge ${s.active ? 'badge-green' : 'badge-red'}`}>{s.active ? 'Active' : 'Paused'}</span>
                  </div>
                  <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 8 }}>{s.message}</div>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {s.isRecurring ? (
                        <>⏰ <code style={{ background: 'var(--bg3)', padding: '1px 6px', borderRadius: 5, color: 'var(--accent3)', fontSize: 11 }}>{s.cronExpr}</code></>
                      ) : (
                        <>📅 <span style={{ fontWeight: 600, color: 'var(--accent3)' }}>{new Date(s.scheduledAt).toLocaleString()}</span></>
                      )}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>📱 {s.contacts.length} contacts</span>
                    {s.lastRun && <span style={{ fontSize: 11, color: 'var(--text3)' }}>✅ Last: {new Date(s.lastRun).toLocaleString()}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label className="toggle">
                    <input type="checkbox" checked={s.active} onChange={() => toggle(s.id)} />
                    <span className="toggle-slider" />
                  </label>
                  <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => deleteSchedule(s.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="card fade-in" style={{ width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 17 }}>New Schedule</h3>
              <button onClick={() => setShowNew(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={18} /></button>
            </div>
            <form onSubmit={createSchedule}>
              <div className="form-group">
                <label className="label">Schedule Name *</label>
                <input className="input" placeholder="Daily Morning Greet" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="label">Message *</label>
                <textarea className="textarea" placeholder="Good morning! 🌅 Today's update..." value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} required />
              </div>

              {/* Cron */}
              <div className="form-group">
                <label className="label">Schedule Type</label>
                <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                  <button type="button" className={`btn ${!form.isRecurring ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1, fontSize: 12 }} onClick={() => setForm({ ...form, isRecurring: false })}>One Time</button>
                  <button type="button" className={`btn ${form.isRecurring ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1, fontSize: 12 }} onClick={() => setForm({ ...form, isRecurring: true })}>Recurring</button>
                </div>

                {!form.isRecurring ? (
                  <div>
                    <label className="label">Date & Time *</label>
                    <input type="datetime-local" className="input" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} required={!form.isRecurring} />
                  </div>
                ) : (
                  <div>
                    <label className="label">Cron Expression *</label>
                    <input className="input" style={{ fontFamily: 'monospace' }} placeholder="0 9 * * *" value={form.cronExpr} onChange={e => setForm(f => ({ ...f, cronExpr: e.target.value }))} required={form.isRecurring} />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
                      {PRESETS.map(p => (
                        <button key={p.cron} type="button"
                          className={`btn btn-ghost`}
                          style={{ fontSize: 11, padding: '4px 10px', background: form.cronExpr === p.cron ? 'rgba(124,58,237,0.2)' : undefined, borderColor: form.cronExpr === p.cron ? 'var(--accent)' : undefined }}
                          onClick={() => setForm(f => ({ ...f, cronExpr: p.cron }))}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="label">Contact Group</label>
                  <select className="select" value={form.group} onChange={e => setForm(f => ({ ...f, group: e.target.value }))}>
                    <option value="">All contacts</option>
                    {groups.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="label">Or enter phones manually</label>
                <textarea className="textarea" placeholder={"919876543210\n919123456789"} value={form.phones} onChange={e => setForm(f => ({ ...f, phones: e.target.value }))} style={{ minHeight: 80, fontFamily: 'monospace', fontSize: 13 }} />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
