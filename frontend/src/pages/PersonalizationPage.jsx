import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { UserCheck, Code, HelpCircle, Save, Info, Plus, Trash2, Wand2 } from 'lucide-react';

export default function PersonalizationPage() {
    const [contacts, setContacts] = useState([]);
    const [globalVars, setGlobalVars] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newVar, setNewVar] = useState({ key: '', value: '' });

    const loadData = async () => {
        setLoading(true);
        try {
            const [cR, gR] = await Promise.all([
                api.get('/contacts'),
                api.get('/global-vars')
            ]);
            setContacts(cR.data.filter(c => c.variables && Object.keys(c.variables).length > 0));
            setGlobalVars(gR.data);
        } catch (err) { }
        finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, []);

    const addGlobalVar = async (e) => {
        e.preventDefault();
        if (!newVar.key || !newVar.value) return;
        try {
            await api.post('/global-vars', newVar);
            toast.success('Variable saved!');
            setNewVar({ key: '', value: '' });
            loadData();
        } catch (err) {
            toast.error('Failed to save');
        }
    };

    const deleteGlobalVar = async (id) => {
        try {
            await api.delete(`/global-vars/${id}`);
            toast.success('Deleted');
            loadData();
        } catch (err) {
            toast.error('Failed to delete');
        }
    };

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <div className="page-title">Personalization Setup</div>
                    <div className="page-sub">Create global shortcuts and dynamic fields</div>
                </div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: '1fr 1.2fr', gap: 24 }}>

                {/* Global Variables Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div className="card" style={{ padding: 24 }}>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                            <Wand2 size={18} color="var(--accent3)" /> Global Custom Variables
                        </h4>
                        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
                            Create shortcuts that work in every message. For example, set <code>{"{{new}}"}</code> to mean <code>"i realy sorry"</code>.
                        </p>

                        <form onSubmit={addGlobalVar} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                            <input
                                className="input"
                                placeholder="new"
                                style={{ flex: 1 }}
                                value={newVar.key}
                                onChange={e => setNewVar({ ...newVar, key: e.target.value.replace(/[^a-zA-Z0-9]/g, '') })}
                            />
                            <input
                                className="input"
                                placeholder="i realy sorry"
                                style={{ flex: 2 }}
                                value={newVar.value}
                                onChange={e => setNewVar({ ...newVar, value: e.target.value })}
                            />
                            <button type="submit" className="btn btn-primary" style={{ padding: '0 15px' }}>
                                <Plus size={16} />
                            </button>
                        </form>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {globalVars.map(v => (
                                <div key={v.id} style={{ background: 'var(--bg3)', padding: '12px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <code style={{ color: 'var(--accent3)', fontWeight: 700 }}>{"{{"}{v.key}{"}}"}</code>
                                        <span style={{ margin: '0 10px', color: 'var(--text3)' }}>→</span>
                                        <span style={{ fontSize: 13, color: 'var(--text)' }}>"{v.value}"</span>
                                    </div>
                                    <button onClick={() => deleteGlobalVar(v.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 5 }}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                            {globalVars.length === 0 && (
                                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)', fontSize: 12, border: '1px dashed var(--border)', borderRadius: 12 }}>
                                    No global variables yet. Add one above!
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="card" style={{ padding: 24 }}>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                            <HelpCircle size={18} color="var(--accent3)" /> Usage Guide
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                            <p>1. Type <code>{"{{your_key}}"}</code> in your message.</p>
                            <p>2. System first checks Global Variables.</p>
                            <p>3. Then it checks Contact Variables (from Bulk Import).</p>
                            <p>4. Finally, it checks the <code>{"{{name}}"}</code> field.</p>
                        </div>
                    </div>
                </div>

                {/* Contact Statistics Section */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: 18, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <UserCheck size={18} color="var(--accent3)" />
                        <h4 style={{ fontSize: 14 }}>Contacts with Individual Variables</h4>
                    </div>

                    {loading ? (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading...</div>
                    ) : (
                        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                            <table className="table" style={{ fontSize: 12 }}>
                                <thead>
                                    <tr>
                                        <th>Name / Phone</th>
                                        <th>Custom Data</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {contacts.map(c => (
                                        <tr key={c.id}>
                                            <td style={{ fontWeight: 600 }}>{c.name || c.phone}</td>
                                            <td>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                    {Object.entries(c.variables || {}).map(([k, v]) => (
                                                        <span key={k} style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>
                                                            <strong style={{ color: 'var(--accent3)' }}>{k}:</strong> {v}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {contacts.length === 0 && (
                                        <tr>
                                            <td colSpan="2" style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>
                                                No individual variables found. <br />
                                                <small>Import contacts with extra columns to see them here.</small>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
