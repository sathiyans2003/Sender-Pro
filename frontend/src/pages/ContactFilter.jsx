import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Search, Filter, X, Download, Users, ChevronDown, Check, Trash2, Edit2, Save } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────
function matchesFilter(contact, filters) {
  const { search, group, source, dateFrom, dateTo, hasName } = filters;

  // Search: name or phone
  if (search) {
    const q = search.toLowerCase();
    const nameMatch = contact.name?.toLowerCase().includes(q);
    const phoneMatch = contact.phone?.toLowerCase().includes(q);
    if (!nameMatch && !phoneMatch) return false;
  }

  // Group filter
  if (group && contact.group !== group) return false;

  // Source filter (manual | import | group_grab)
  if (source && contact.source !== source) return false;

  // Has name filter
  if (hasName === 'yes' && !contact.name) return false;
  if (hasName === 'no' && contact.name) return false;

  // Date range
  const created = new Date(contact.createdAt);
  if (dateFrom && created < new Date(dateFrom)) return false;
  if (dateTo && created > new Date(dateTo + 'T23:59:59')) return false;

  // WhatsApp filter
  if (filters.isWhatsApp === 'yes' && contact.isWhatsApp !== true) return false;
  if (filters.isWhatsApp === 'no' && contact.isWhatsApp !== false) return false;
  if (filters.isWhatsApp === 'unchecked' && contact.isWhatsApp !== null) return false;

  return true;
}

// ── Main Component ───────────────────────────────────────────
export default function ContactFilter({ onFilteredContacts }) {
  const [allContacts, setAllContacts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [groups, setGroups] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', group: '' });

  const [filters, setFilters] = useState({
    search: '',
    group: '',
    source: '',
    dateFrom: '',
    dateTo: '',
    hasName: '',
    isWhatsApp: '',
  });

  // Load contacts
  useEffect(() => {
    api.get('/contacts').then(r => {
      setAllContacts(r.data);
      setFiltered(r.data);
      const g = [...new Set(r.data.map(c => c.group).filter(Boolean))];
      setGroups(g);
    }).catch(() => toast.error('Failed to load contacts'))
      .finally(() => setLoading(false));
  }, []);

  // Apply filters whenever they change
  useEffect(() => {
    const result = allContacts.filter(c => matchesFilter(c, filters));
    setFiltered(result);
    setSelected([]);
    if (onFilteredContacts) onFilteredContacts(result);
  }, [filters, allContacts]);

  const update = (key, val) => setFilters(f => ({ ...f, [key]: val }));

  const clearFilters = () => setFilters({ search: '', group: '', source: '', dateFrom: '', dateTo: '', hasName: '', isWhatsApp: '' });

  const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

  // Select / deselect
  const toggleSelect = (id) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleAll = () =>
    setSelected(s => s.length === filtered.length ? [] : filtered.map(c => c.id));

  // Export selected (or all filtered) as CSV
  const exportCSV = () => {
    const rows = (selected.length > 0 ? filtered.filter(c => selected.includes(c.id)) : filtered);
    const csv = ['Phone,Name,Group,Source,Added',
      ...rows.map(c => `${c.phone},${c.name || ''},${c.group || ''},${c.source || ''},${new Date(c.createdAt).toLocaleDateString()}`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_filtered.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} contacts`);
  };

  // Use filtered contacts in a campaign
  const useInCampaign = () => {
    const phones = (selected.length > 0
      ? filtered.filter(c => selected.includes(c.id))
      : filtered
    ).map(c => c.phone);
    navigator.clipboard.writeText(phones.join('\n'));
    toast.success(`${phones.length} phone numbers copied to clipboard!`);
  };

  // Delete a single contact
  const deleteContact = async (id) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      await api.delete(`/contacts/${id}`);
      setAllContacts(prev => prev.filter(c => c.id !== id));
      toast.success('Contact deleted');
    } catch { toast.error('Failed to delete contact'); }
  };

  const startEdit = (contact) => {
    setEditingId(contact.id);
    setEditForm({ name: contact.name || '', phone: contact.phone || '', group: typeof contact.group === 'object' ? contact.group.name : (contact.group || '') });
  };

  const saveEdit = async (id) => {
    try {
      const { data } = await api.put(`/contacts/${id}`, editForm);
      setAllContacts(prev => prev.map(c => c.id === id ? data : c));
      setEditingId(null);
      toast.success('Contact updated');
    } catch (err) {
      toast.error('Failed to update contact');
    }
  };

  // Delete multiple selected contacts
  const deleteSelected = async () => {
    if (!selected.length) return;
    if (!confirm(`Are you sure you want to delete ${selected.length} contacts?`)) return;
    try {
      await api.delete('/contacts', { data: { ids: selected } });
      setAllContacts(prev => prev.filter(c => !selected.includes(c.id)));
      setSelected([]);
      toast.success('Selected contacts deleted');
    } catch { toast.error('Failed to delete selected contacts'); }
  };

  // Validate WhatsApp for selected or filtered
  const validateWhatsApp = async () => {
    const ids = selected.length > 0 ? selected : filtered.map(c => c.id);
    if (!ids.length) return;

    setLoading(true);
    try {
      const { data } = await api.post('/contacts/validate', { ids });
      toast.success(`Validated: ${data.valid} WhatsApp, ${data.invalid} Not WhatsApp`);
      // Update local state
      api.get('/contacts').then(r => setAllContacts(r.data));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Number Filter</div>
          <div className="page-sub">Validate and segment your WhatsApp contacts</div>
        </div>
      </div>

      <div style={{ fontFamily: 'var(--font)' }}>

        {/* ── Top Bar ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>

          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
            <input
              className="input"
              style={{ paddingLeft: 36 }}
              placeholder="Search name or phone..."
              value={filters.search}
              onChange={e => update('search', e.target.value)}
            />
          </div>

          {/* Filter toggle button */}
          <button
            className={`btn ${showPanel ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setShowPanel(p => !p)}
          >
            <Filter size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span style={{ background: 'var(--red)', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                {activeFilterCount}
              </span>
            )}
          </button>

          {activeFilterCount > 0 && (
            <button className="btn btn-ghost" onClick={clearFilters} style={{ fontSize: 12 }}>
              <X size={13} /> Clear
            </button>
          )}

          {/* Actions */}
          {filtered.length > 0 && (
            <>
              <button className="btn btn-ghost" onClick={exportCSV} style={{ fontSize: 12 }}>
                <Download size={13} />
                Export {selected.length > 0 ? selected.length : filtered.length} CSV
              </button>
              <button className="btn btn-ghost" onClick={validateWhatsApp} style={{ fontSize: 12, color: 'var(--yellow)' }}>
                <Check size={13} /> Validate WA
              </button>
              <button className="btn btn-success" onClick={useInCampaign} style={{ fontSize: 12 }}>
                📋 Copy Phones
              </button>
              {selected.length > 0 && (
                <button className="btn btn-danger" onClick={deleteSelected} style={{ fontSize: 12 }}>
                  <Trash2 size={13} /> Delete ({selected.length})
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Filter Panel ── */}
        {showPanel && (
          <div className="card" style={{ marginBottom: 16, padding: '18px 20px', background: 'var(--bg2)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>

              {/* Group */}
              <div>
                <label className="label">Group</label>
                <select className="select" value={filters.group} onChange={e => update('group', e.target.value)}>
                  <option value="">All Groups</option>
                  {groups.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              {/* Source */}
              <div>
                <label className="label">Source</label>
                <select className="select" value={filters.source} onChange={e => update('source', e.target.value)}>
                  <option value="">All Sources</option>
                  <option value="manual">Manual</option>
                  <option value="import">Imported</option>
                  <option value="group_grab">Group Grabbed</option>
                </select>
              </div>

              {/* Has Name */}
              <div>
                <label className="label">Has Name</label>
                <select className="select" value={filters.hasName} onChange={e => update('hasName', e.target.value)}>
                  <option value="">All</option>
                  <option value="yes">Has name</option>
                  <option value="no">No name</option>
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="label">Added From</label>
                <input
                  className="input"
                  type="date"
                  value={filters.dateFrom}
                  onChange={e => update('dateFrom', e.target.value)}
                />
              </div>

              {/* Date To */}
              <div>
                <label className="label">Added To</label>
                <input
                  className="input"
                  type="date"
                  value={filters.dateTo}
                  onChange={e => update('dateTo', e.target.value)}
                />
              </div>

              {/* WhatsApp Status */}
              <div>
                <label className="label">WhatsApp Status</label>
                <select className="select" value={filters.isWhatsApp} onChange={e => update('isWhatsApp', e.target.value)}>
                  <option value="">All</option>
                  <option value="yes">WhatsApp numbers</option>
                  <option value="no">Not on WhatsApp</option>
                  <option value="unchecked">Not Checked</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── Results Summary ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            Showing <strong style={{ color: 'var(--accent3)' }}>{filtered.length}</strong> of {allContacts.length} contacts
            {selected.length > 0 && <span style={{ color: 'var(--yellow)', marginLeft: 8 }}>· {selected.length} selected</span>}
          </div>
          {filtered.length > 0 && (
            <button
              onClick={toggleAll}
              style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {selected.length === filtered.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        {/* ── Contact Table ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state card">
            <Users size={44} />
            <h3>No Contacts Found</h3>
            <p>Try adjusting your filters</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={selected.length === filtered.length && filtered.length > 0}
                      onChange={toggleAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th>Phone</th>
                  <th>Name</th>
                  <th>Group</th>
                  <th>Source</th>
                  <th>WhatsApp</th>
                  <th>Added</th>
                  <th style={{ width: 60, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} style={{ background: selected.includes(c.id) ? 'rgba(124,58,237,0.06)' : undefined }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.includes(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    {editingId === c.id ? (
                      <>
                        <td><input className="input" style={{ padding: '4px 8px', fontSize: 13 }} value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></td>
                        <td><input className="input" style={{ padding: '4px 8px', fontSize: 13 }} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Name" /></td>
                        <td><input className="input" style={{ padding: '4px 8px', fontSize: 13 }} value={editForm.group} onChange={e => setEditForm(f => ({ ...f, group: e.target.value }))} placeholder="Group" /></td>
                        <td><span className="badge badge-yellow">Editing</span></td>
                        <td>-</td>
                        <td>-</td>
                        <td style={{ textAlign: 'center' }}>
                          <button className="btn btn-success" style={{ padding: '5px' }} onClick={() => saveEdit(c.id)} title="Save"><Save size={14} /></button>
                          <button className="btn btn-ghost" style={{ padding: '5px', marginLeft: 4 }} onClick={() => setEditingId(null)} title="Cancel"><X size={14} /></button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{c.phone}</td>
                        <td style={{ color: 'var(--text)', fontWeight: 500 }}>{c.name || <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>No name</span>}</td>
                        <td><span className="badge badge-purple">{typeof c.group === 'object' ? c.group.name : c.group}</span></td>
                        <td>
                          <span className={`badge ${c.source === 'import' ? 'badge-yellow' : c.source === 'group_grab' ? 'badge-green' : 'badge-purple'}`}>
                            {c.source}
                          </span>
                        </td>
                        <td>
                          {c.isWhatsApp === true && <span className="badge badge-green">Yes</span>}
                          {c.isWhatsApp === false && <span className="badge badge-red">No</span>}
                          {c.isWhatsApp === null && <span className="badge badge-ghost">Pending</span>}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text3)' }}>
                          {new Date(c.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ textAlign: 'center', display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button
                            className="btn btn-ghost"
                            style={{ color: 'var(--accent3)', padding: '5px' }}
                            onClick={() => startEdit(c)}
                            title="Edit Contact"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ color: 'var(--red)', padding: '5px' }}
                            onClick={() => deleteContact(c.id)}
                            title="Delete Contact"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div >
  );
}
