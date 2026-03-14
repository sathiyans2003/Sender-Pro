import React, { useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Upload, X, FileSpreadsheet } from 'lucide-react';
import ContactFilter from './ContactFilter';

export default function ContactsPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', group: 'Default' });
  const [bulkText, setBulkText] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [colMapping, setColMapping] = useState({ phone: 1, name: 2, group: 3 });

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

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.XLSX) {
      toast.error('Excel parser not loaded yet');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Read raw data starting from the first row to parse custom arrays
        const json = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!json || json.length === 0) return toast.error('File is empty!');

        // Auto-detect columns from the first row (header row)
        const headerRow = json[0] || [];
        let pFound = 1, nFound = 2, gFound = 3;
        let fnFound = -1, lnFound = -1;

        headerRow.forEach((colName, idx) => {
          if (!colName || typeof colName !== 'string') return;
          const lowerCol = colName.toString().toLowerCase().trim();
          if (lowerCol.includes('phone') || lowerCol.includes('number') || lowerCol.includes('mobile')) {
            pFound = idx + 1;
          } else if (lowerCol === 'first name' || lowerCol === 'first_name' || lowerCol === 'fname') {
            fnFound = idx;
          } else if (lowerCol === 'last name' || lowerCol === 'last_name' || lowerCol === 'lname') {
            lnFound = idx;
          } else if (lowerCol.includes('name') && fnFound === -1 && lnFound === -1) {
            nFound = idx + 1;
          } else if (lowerCol === 'group') {
            gFound = idx + 1;
          }
        });

        // Merge first name and last name if they were found
        if (fnFound !== -1 || lnFound !== -1) {
          const fullNameIdx = headerRow.length;
          headerRow[fullNameIdx] = 'Merged Name';
          nFound = fullNameIdx + 1;

          for (let i = 1; i < json.length; i++) {
            const row = json[i];
            if (!row || row.length === 0) continue;
            const fName = fnFound !== -1 ? (row[fnFound] || '').toString().trim() : '';
            const lName = lnFound !== -1 ? (row[lnFound] || '').toString().trim() : '';
            row[fullNameIdx] = `${fName} ${lName}`.trim();
            // Clear original so they don't get saved as random custom variables
            if (fnFound !== -1) row[fnFound] = '';
            if (lnFound !== -1) row[lnFound] = '';
          }
        }

        setColMapping({ phone: pFound, name: nFound, group: gFound });

        // Convert array to CSV lines, skipping completely empty rows
        const lines = json
          .filter(row => row.length > 0)
          .map(row => row.join(','))
          .join('\n');

        setBulkText(prev => prev ? prev + '\n' + lines : lines);
        toast.success(`Loaded ${json.length} rows! Auto-detected columns.`);
      } catch (err) {
        toast.error('Failed to parse file. Ensure it is a valid CSV/Excel format.');
      }
      e.target.value = null; // reset input
    };
    reader.readAsArrayBuffer(file);
  };

  const bulkImport = async () => {
    const lines = bulkText.trim().split('\n').filter(Boolean);
    const parsed = lines.map(l => {
      // Handle simple comma separation (ignoring quotes for simplicity or relying on standard CSV)
      // A more robust CSV split could be used, but since we rely on the textarea or converted Excel data:
      const p = l.split(',').map(x => x.trim());

      const pIdx = colMapping.phone - 1;
      const nIdx = colMapping.name - 1;
      const gIdx = colMapping.group - 1;

      const contactData = {
        phone: p[pIdx],
        name: p[nIdx] || '',
        group: p[gIdx] || 'Import'
      };

      // All other columns become variables
      const usedIndexes = [pIdx, nIdx, gIdx];
      const vars = {};
      let varCounter = 1;
      p.forEach((val, idx) => {
        if (!usedIndexes.includes(idx) && val) {
          vars[`var${varCounter}`] = val;
          varCounter++;
        }
      });
      if (Object.keys(vars).length > 0) {
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
          <div style={{ marginBottom: 16 }}>
            <label className="btn btn-secondary" style={{ width: '100%', cursor: 'pointer', justifyContent: 'center', background: 'rgba(124,58,237,0.1)', color: 'var(--accent3)', border: '1px dashed var(--accent)', padding: 14 }}>
              <FileSpreadsheet size={18} />
              Upload .CSV or .XLSX File
              <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" hidden onChange={handleFileUpload} />
            </label>
            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
              Columns format: Phone, Name, Group, [Custom Var 1], [Custom Var 2]...
            </div>
          </div>

          <div style={{ background: 'var(--bg2)', padding: 12, borderRadius: 10, border: '1px solid var(--border)', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Select Column Order (1-based index)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div>
                <label className="label" style={{ fontSize: 10 }}>Phone Column</label>
                <input className="input" type="number" min="1" value={colMapping.phone} onChange={e => setColMapping(p => ({ ...p, phone: +e.target.value }))} style={{ padding: '6px 10px' }} />
              </div>
              <div>
                <label className="label" style={{ fontSize: 10 }}>Name Column</label>
                <input className="input" type="number" min="1" value={colMapping.name} onChange={e => setColMapping(p => ({ ...p, name: +e.target.value }))} style={{ padding: '6px 10px' }} />
              </div>
              <div>
                <label className="label" style={{ fontSize: 10 }}>Group Column</label>
                <input className="input" type="number" min="1" value={colMapping.group} onChange={e => setColMapping(p => ({ ...p, group: +e.target.value }))} style={{ padding: '6px 10px' }} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
              Remaining columns will be automatically added as custom variables.
            </div>
          </div>

          <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, marginBottom: 16, marginTop: -4 }}>— OR paste manually below —</div>

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
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card fade-in" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 17 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
