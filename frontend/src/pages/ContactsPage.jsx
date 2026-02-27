import React, { useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Upload, X } from 'lucide-react';
import ContactFilter from './ContactFilter';

export default function ContactsPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', group: 'Default' });
  const [bulkText, setBulkText] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const addContact = async (e) => {
    e.preventDefault();
    try {
      await api.post('/contacts', form);
      setShowAdd(false);
      setForm({ name: '', phone: '', group: 'Default' });
      setRefreshKey(k => k + 1);
      toast.success('Contact added!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const bulkImport = async () => {
    const lines = bulkText.trim().split('\n').filter(Boolean);
    const parsed = lines.map(l => {
      const p = l.split(',').map(x => x.trim());
      const contactData = { phone: p[0], name: p[1] || '', group: p[2] || 'Import' };

      // Additional columns are treated as custom variables: var1, var2, etc.
      if (p.length > 3) {
        const vars = {};
        p.slice(3).forEach((val, idx) => {
          vars[`var${idx + 1}`] = val;
        });
        contactData.variables = vars;
      }
      return contactData;
    }).filter(c => c.phone);

    if (!parsed.length) return toast.error('No valid contacts found');
    try {
      const { data } = await api.post('/contacts/bulk', { contacts: parsed });
      toast.success(`Imported ${data.imported} contacts`);
      setShowBulk(false);
      setBulkText('');
      setRefreshKey(k => k + 1);
    } catch { toast.error('Import failed'); }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Contacts</div>
          <div className="page-sub">Filter, search and manage your contacts</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => setShowBulk(true)}><Upload size={14} /> Bulk Import</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={14} /> Add Contact</button>
        </div>
      </div>

      <ContactFilter key={refreshKey} />

      {showAdd && (
        <Modal title="Add Contact" onClose={() => setShowAdd(false)}>
          <form onSubmit={addContact}>
            <div className="form-group">
              <label className="label">Name (optional)</label>
              <input className="input" placeholder="John Doe" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">Phone *</label>
              <input className="input" placeholder="919876543210" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required />
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Country code include பண்ணு (91...)</div>
            </div>
            <div className="form-group">
              <label className="label">Group</label>
              <input className="input" placeholder="Default" value={form.group} onChange={e => setForm(f => ({ ...f, group: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add</button>
            </div>
          </form>
        </Modal>
      )}

      {showBulk && (
        <Modal title="Bulk Import" onClose={() => setShowBulk(false)}>
          <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 12 }}>
            Format: <code style={{ color: 'var(--accent3)' }}>phone, name, group</code> — one per line
          </p>
          <textarea className="textarea" style={{ minHeight: 160, fontFamily: 'monospace', fontSize: 13 }}
            placeholder={"919876543210, John, VIP\n919123456789\n91..."}
            value={bulkText} onChange={e => setBulkText(e.target.value)} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn btn-ghost" onClick={() => setShowBulk(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={bulkImport}>Import</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card fade-in" style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 17 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
