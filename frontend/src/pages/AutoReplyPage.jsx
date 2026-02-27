import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Bot, Trash2, X, Upload, Image, FileText } from 'lucide-react';

const COMMON_EMOJIS = ['😊', '😂', '❤️', '👍', '🙏', '🔥', '✨', '🎉', '✅', '❌', '🛑', '👇', '👉', '🚀', '💰'];

const TRIGGER_TYPES = [
  { value: 'contains', label: 'Contains keyword' },
  { value: 'exact', label: 'Exact match' },
  { value: 'any', label: 'Any message' },
];

export default function AutoReplyPage() {
  const [rules, setRules] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ trigger: '', triggerType: 'contains', response: '', mediaUrl: '' });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/autoreply'); setRules(data); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const addRule = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/autoreply', form);
      setRules(r => [data, ...r]);
      setShowNew(false);
      setForm({ trigger: '', triggerType: 'contains', response: '', mediaUrl: '' });
      toast.success('Rule added');
    } catch { toast.error('Failed'); }
  };

  const toggle = async (id) => {
    const { data } = await api.patch(`/autoreply/${id}/toggle`);
    setRules(r => r.map(x => x.id === id ? data : x));
  };

  const deleteRule = async (id) => {
    await api.delete(`/autoreply/${id}`);
    setRules(r => r.filter(x => x.id !== id));
    toast.success('Deleted');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const toastId = toast.loading('Uploading media...');
      try {
        const { data } = await api.post('/upload', {
          fileName: file.name,
          fileData: reader.result,
          fileType: file.type,
        });
        setForm(f => ({ ...f, mediaUrl: data.url }));
        toast.success('Media uploaded successfully!', { id: toastId });
      } catch (err) {
        toast.error('Upload failed', { id: toastId });
      }
    };
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Auto Reply</div>
          <div className="page-sub">Automatically respond to incoming messages</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> Add Rule</button>
      </div>

      {/* Info banner */}
      <div style={{ padding: '14px 18px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 12, marginBottom: 20, fontSize: 13, color: 'var(--text2)' }}>
        <strong style={{ color: 'var(--accent3)' }}>How it works:</strong> When someone sends a message to your connected WhatsApp, it checks these rules in order and replies with the first matching one.
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading...</div>
      ) : rules.length === 0 ? (
        <div className="empty-state card">
          <Bot size={48} />
          <h3>No Auto Reply Rules</h3>
          <p>Add rules to automatically respond to messages</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rules.map((rule, idx) => (
            <div key={rule.id} className="card" style={{ opacity: rule.active ? 1 : 0.5, transition: 'opacity 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ color: 'var(--text3)', fontSize: 13, fontWeight: 700, minWidth: 22, paddingTop: 2 }}>#{idx + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span className="badge badge-purple">{TRIGGER_TYPES.find(t => t.value === rule.triggerType)?.label}</span>
                    {rule.triggerType !== 'any' && (
                      <code style={{ background: 'var(--bg3)', padding: '2px 8px', borderRadius: 6, fontSize: 12, color: 'var(--accent3)' }}>{rule.trigger}</code>
                    )}
                  </div>
                  <div style={{ color: 'var(--text2)', fontSize: 13, background: 'var(--bg2)', padding: '10px 14px', borderRadius: 10, borderLeft: '3px solid var(--accent)' }}>
                    {rule.mediaUrl && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--accent)', marginBottom: 6 }}>
                        <FileText size={13} /> [Contains Media Attachment]
                      </div>
                    )}
                    <span style={{ whiteSpace: 'pre-wrap' }}>{rule.response || <i>(No text)</i>}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label className="toggle">
                    <input type="checkbox" checked={rule.active} onChange={() => toggle(rule.id)} />
                    <span className="toggle-slider" />
                  </label>
                  <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => deleteRule(rule.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="card fade-in" style={{ width: '100%', maxWidth: 480 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 17 }}>New Auto Reply Rule</h3>
              <button onClick={() => setShowNew(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={18} /></button>
            </div>
            <form onSubmit={addRule}>
              <div className="form-group">
                <label className="label">Trigger Type</label>
                <select className="select" value={form.triggerType} onChange={e => setForm(f => ({ ...f, triggerType: e.target.value }))}>
                  {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {form.triggerType !== 'any' && (
                <div className="form-group">
                  <label className="label">Trigger Keyword *</label>
                  <input className="input" placeholder="hello, hi, price, order..." value={form.trigger} onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))} required />
                </div>
              )}
              <div className="form-group">
                <label className="label">Reply Message *</label>
                <textarea className="textarea" placeholder="Hi! Thanks for reaching out. We'll get back to you soon." value={form.response} onChange={e => setForm(f => ({ ...f, response: e.target.value }))} required={!form.mediaUrl} />

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {COMMON_EMOJIS.map(emoji => (
                    <button key={emoji} type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
                      onClick={() => setForm(f => ({ ...f, response: f.response + emoji }))}
                    >{emoji}</button>
                  ))}
                </div>

                <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', background: 'var(--bg2)', padding: '10px', borderRadius: 8 }}>
                  <label className="btn btn-ghost" style={{ border: '1px dashed var(--border)', cursor: 'pointer', padding: '6px 12px', fontSize: 12 }}>
                    <Upload size={14} /> Upload Media
                    <input type="file" onChange={handleFileUpload} hidden />
                  </label>
                  {form.mediaUrl ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' }}>
                      <span style={{ fontSize: 11, color: 'var(--accent)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>{form.mediaUrl.split('/').pop()}</span>
                      <button type="button" onClick={() => setForm(f => ({ ...f, mediaUrl: '' }))} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 11 }}><Trash2 size={13} /></button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>No media attached.</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
