import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Play, Trash2, Megaphone, RotateCcw, X, RefreshCw, Upload, Image, File } from 'lucide-react';

const STATUS_BADGE = {
  draft: 'badge-purple',
  running: 'badge-yellow',
  completed: 'badge-green',
  failed: 'badge-red',
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: '', message: '', delay: 3, mediaUrl: '', phones: '', group: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [c, ct] = await Promise.all([api.get('/campaigns'), api.get('/contacts')]);
      setCampaigns(c.data);
      setContacts(ct.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Auto-refresh running campaigns
  useEffect(() => {
    const hasRunning = campaigns.some(c => c.status === 'running');
    if (!hasRunning) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [campaigns]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64 = reader.result;
        const { data } = await api.post('/upload', {
          base64,
          filename: file.name,
          fileType: file.type
        });
        setForm(prev => ({ ...prev, mediaUrl: data.url }));
        toast.success('File uploaded successfully!');
      } catch (err) {
        toast.error('File upload failed');
      } finally {
        setUploading(false);
      }
    };
  };

  const createCampaign = async (e) => {
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
      const { data } = await api.post('/campaigns', { ...form, contacts: phoneList });
      setCampaigns(c => [data, ...c]);
      setShowNew(false);
      setForm({ name: '', message: '', delay: 3, mediaUrl: '', phones: '', group: '' });
      toast.success('Campaign created!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const startCampaign = async (id) => {
    try {
      await api.post(`/campaigns/${id}/start`);
      toast.success('Campaign started!');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start');
    }
  };

  const resendCampaign = async (id) => {
    try {
      await api.post(`/campaigns/${id}/resend`);
      toast.success('Campaign resending...');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend');
    }
  };

  const deleteCampaign = async (id) => {
    if (!window.confirm('Delete this campaign?')) return;
    await api.delete(`/campaigns/${id}`);
    setCampaigns(c => c.filter(x => x.id !== id));
    toast.success('Deleted');
  };

  const groups = [...new Set(contacts.map(c => c.group))];
  const progress = (c) => c.total > 0 ? Math.round(((c.sent + c.failed) / c.total) * 100) : 0;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Campaigns</div>
          <div className="page-sub">Bulk message sending</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={load}><RefreshCw size={14} /> Refresh</button>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> New Campaign</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading...</div>
      ) : campaigns.length === 0 ? (
        <div className="empty-state card">
          <Megaphone size={48} />
          <h3>No Campaigns</h3>
          <p>Create your first bulk message campaign</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {campaigns.map(c => (
            <div key={c.id} className="card">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Megaphone size={18} color="var(--accent3)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15 }}>{c.name}</span>
                    <span className={`badge ${STATUS_BADGE[c.status] || 'badge-purple'}`}>{c.status}</span>
                  </div>
                  <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 10, lineClamp: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {c.message}
                  </div>
                  {/* Progress */}
                  {c.total > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', marginBottom: 5 }}>
                        <span>{c.sent} sent · {c.failed} failed · {c.total} total</span>
                        <span>{progress(c)}%</span>
                      </div>
                      <div style={{ height: 5, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progress(c)}%`, background: c.failed > c.sent ? 'var(--red)' : 'linear-gradient(90deg, var(--accent), var(--accent3))', borderRadius: 99, transition: 'width 0.4s' }} />
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    Delay: {c.delay}s · Created: {new Date(c.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                  {c.status === 'draft' && (
                    <button className="btn btn-success" style={{ padding: '7px 14px' }} onClick={() => startCampaign(c.id)}>
                      <Play size={13} /> Start
                    </button>
                  )}
                  {c.status === 'failed' && (
                    <button className="btn btn-primary" style={{ padding: '7px 14px', fontSize: 12 }} onClick={() => resendCampaign(c.id)}>
                      <RotateCcw size={13} /> Resend
                    </button>
                  )}
                  {c.status !== 'running' && (
                    <button className="btn btn-danger" style={{ padding: '7px 10px' }} onClick={() => deleteCampaign(c.id)}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Campaign Modal */}
      {showNew && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }} onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="card fade-in" style={{ width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 17 }}>New Campaign</h3>
              <button onClick={() => setShowNew(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={18} /></button>
            </div>
            <form onSubmit={createCampaign}>
              <div className="form-group">
                <label className="label">Campaign Name *</label>
                <input className="input" placeholder="Summer Sale 2024" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="label">Message *</label>
                <textarea className="textarea" placeholder="Type your message here..." value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} required style={{ minHeight: 120 }} />
              </div>
              <div className="form-group">
                <label className="label">Image / Media</label>
                <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Image size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                    <input
                      className="input"
                      style={{ paddingLeft: 36 }}
                      placeholder="https://example.com/image.jpg"
                      value={form.mediaUrl}
                      onChange={e => setForm(f => ({ ...f, mediaUrl: e.target.value }))}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label className="btn btn-ghost" style={{ flex: 1, height: 40, cursor: 'pointer', border: '1px dashed var(--border)', fontSize: 13 }}>
                      <Upload size={14} />
                      {uploading ? 'Uploading...' : 'Upload File (Max 50MB)'}
                      <input type="file" onChange={handleFileUpload} hidden disabled={uploading} />
                    </label>
                    {form.mediaUrl && (
                      <button type="button" className="btn btn-ghost" style={{ color: 'var(--red)' }} onClick={() => setForm(f => ({ ...f, mediaUrl: '' }))}>
                        Clear
                      </button>
                    )}
                  </div>
                  {form.mediaUrl && (
                    <div style={{ marginTop: 8, padding: 8, background: 'var(--bg3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <File size={16} color="var(--accent3)" />
                      <span style={{ fontSize: 11, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {form.mediaUrl.split('/').pop()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <label className="label">Contact Group</label>
                  <select className="select" value={form.group} onChange={e => setForm(f => ({ ...f, group: e.target.value }))}>
                    <option value="">All contacts</option>
                    {groups.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Delay (seconds)</label>
                  <input className="input" type="number" min={1} max={60} value={form.delay} onChange={e => setForm(f => ({ ...f, delay: +e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="label">Or enter phone numbers manually</label>
                <textarea className="textarea" placeholder={"919876543210\n919123456789"} value={form.phones} onChange={e => setForm(f => ({ ...f, phones: e.target.value }))} style={{ minHeight: 80, fontFamily: 'monospace', fontSize: 13 }} />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>One per line or comma-separated</div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Campaign</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
