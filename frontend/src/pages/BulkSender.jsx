import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Send, Image, Users, MessageSquare, Clock, Zap, Upload, File, Bold, Italic, Type, Smile, Code, Plus, PlusCircle, Edit3 } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';

export default function BulkSender() {
    const [messages, setMessages] = useState(['']);
    const [activeMsg, setActiveMsg] = useState(0);
    const [contacts, setContacts] = useState([]);
    const [globalVars, setGlobalVars] = useState([]);
    const [newVarModal, setNewVarModal] = useState(false);
    const [newVar, setNewVar] = useState({ key: '', value: '' });
    const [varSearch, setVarSearch] = useState('');

    const [form, setForm] = useState({
        name: '',
        delay: 3,
        mediaUrl: '',
        phones: '',
        group: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get('/contacts').then(r => setContacts(r.data)).catch(() => { });
        api.get('/global-vars').then(r => setGlobalVars(r.data)).catch(() => { });
    }, []);

    const groups = [...new Set(contacts.map(c => {
        if (!c.group) return null;
        return typeof c.group === 'object' ? c.group.name : String(c.group);
    }).filter(Boolean))];

    const [showEmojis, setShowEmojis] = useState(false);
    const [showVars, setShowVars] = useState(false);

    const customVars = [...new Set(contacts.flatMap(c => c.variables ? Object.keys(c.variables) : []))];
    const defaultVars = ['name', 'phone', ...customVars];

    const insertText = (before, after = '') => {
        const textarea = document.getElementById(`msg-input-${activeMsg}`);
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = messages[activeMsg];
        const selected = text.substring(start, end);

        const newText = text.substring(0, start) + before + selected + after + text.substring(end);
        const newMsgs = [...messages];
        newMsgs[activeMsg] = newText;
        setMessages(newMsgs);

        // Reset focus and selection
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + before.length, end + before.length);
        }, 0);
    };

    const [uploading, setUploading] = useState(false);

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

    const addMsg = () => setMessages([...messages, '']);
    const removeMsg = (i) => {
        if (messages.length > 1) {
            const n = messages.filter((_, idx) => idx !== i);
            setMessages(n);
            if (activeMsg >= n.length) setActiveMsg(n.length - 1);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();

        let phoneList = [];
        if (form.phones && form.phones.trim()) {
            phoneList = form.phones.split(/[\n,]/).map(p => p.trim()).filter(Boolean);
        } else if (form.group) {
            phoneList = contacts.filter(c => c.group === form.group).map(c => c.phone);
        } else {
            phoneList = contacts.map(c => c.phone);
        }

        if (!phoneList.length) return toast.error('No contacts selected');
        const validMsgs = messages.filter(m => m.trim());
        if (!validMsgs.length) return toast.error('At least one message is required');

        setLoading(true);
        try {
            const campaignName = form.name || `Bulk Send ${new Date().toLocaleString()}`;

            // For now, we send the first valid message. 
            // Future update: Add rotation logic if backend supports it.
            const response = await api.post('/campaigns', {
                ...form,
                name: campaignName,
                contacts: phoneList,
                message: validMsgs[0]
            });

            const campaignId = response.data.id;
            await api.post(`/campaigns/${campaignId}/start`);

            toast.success('Bulk message campaign started successfully!');
            setForm({ name: '', delay: 3, mediaUrl: '', phones: '', group: '' });
            setMessages(['']);
            setActiveMsg(0);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to start campaign');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateVar = async () => {
        if (!newVar.key || !newVar.value) return toast.error('Key and value required');
        try {
            const { data } = await api.post('/global-vars', newVar);
            setGlobalVars(prev => {
                const existingIndex = prev.findIndex(v => v.key === data.key);
                if (existingIndex >= 0) {
                    const next = [...prev];
                    next[existingIndex] = data;
                    return next;
                }
                return [...prev, data];
            });
            toast.success('Variable saved');
            setNewVar({ key: '', value: '' });
            setNewVarModal(false);
            insertText(`{{${data.key}}}`);
        } catch (err) {
            toast.error('Failed to save variable');
        }
    };

    const allVars = [...new Set([...defaultVars, ...(Array.isArray(globalVars) ? globalVars : []).map(v => v.key)])];

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <div className="page-title">Bulk Sender</div>
                    <div className="page-sub">Send bulk messages to your contacts immediately</div>
                </div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
                <div className="card" style={{ padding: 24 }}>
                    <form onSubmit={handleSend}>
                        <div className="form-group">
                            <label className="label">Campaign Name (Optional)</label>
                            <input
                                className="input"
                                placeholder="Marketing Campaign #1"
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            />
                        </div>

                        {/* Target Audience Section */}
                        <div style={{ marginBottom: 24, padding: 16, background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                            <h4 style={{ marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                                <Users size={16} color="var(--accent3)" /> Target Audience
                            </h4>

                            <div className="form-group">
                                <label className="label">Select Group</label>
                                <select
                                    className="select"
                                    value={form.group}
                                    onChange={e => setForm(f => ({ ...f, group: e.target.value }))}
                                >
                                    <option value="">All Contacts ({contacts.length})</option>
                                    {groups.map(g => (
                                        <option key={g} value={g}>{g}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="label">Manual Numbers (Optional)</label>
                                <textarea
                                    className="textarea"
                                    placeholder="919876543210&#10;919123456789"
                                    value={form.phones}
                                    onChange={e => setForm(f => ({ ...f, phones: e.target.value }))}
                                    style={{ minHeight: 80, fontSize: 12, fontFamily: 'monospace' }}
                                />
                                <p style={{ fontSize: 10, color: 'var(--text3)', margin: '6px 0 0 0' }}>
                                    Enter country code (e.g., 91). One per line.
                                </p>
                            </div>
                        </div>

                        {/* Message Tabs */}
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                                    <MessageSquare size={16} color="var(--accent)" /> Message Contents *
                                </h4>
                                <button type="button" className="btn btn-ghost" onClick={addMsg} style={{ fontSize: 11, padding: '4px 8px' }}>
                                    + Add Message
                                </button>
                            </div>

                            <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
                                {messages.map((_, i) => (
                                    <div key={i} style={{ position: 'relative' }}>
                                        <button
                                            type="button"
                                            onClick={() => setActiveMsg(i)}
                                            style={{
                                                padding: '8px 16px',
                                                borderRadius: 8,
                                                fontSize: 12,
                                                fontWeight: 600,
                                                transition: 'all 0.2s',
                                                whiteSpace: 'nowrap',
                                                border: '1px solid var(--border)',
                                                background: activeMsg === i ? 'rgba(124,58,237,0.1)' : 'transparent',
                                                color: activeMsg === i ? 'var(--accent3)' : 'var(--text3)',
                                                borderColor: activeMsg === i ? 'var(--accent3)' : 'var(--border)',
                                            }}
                                        >
                                            Message {i + 1}
                                        </button>
                                        {messages.length > 1 && (
                                            <div
                                                onClick={(e) => { e.stopPropagation(); removeMsg(i); }}
                                                style={{ position: 'absolute', top: -6, right: -4, background: 'var(--red)', color: 'white', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, cursor: 'pointer' }}
                                            >×</div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
                                <button type="button" className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => insertText('*', '*')}>
                                    <Bold size={14} />
                                </button>
                                <button type="button" className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => insertText('_', '_')}>
                                    <Italic size={14} />
                                </button>
                                <button type="button" className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => insertText('~', '~')}>
                                    <span style={{ textDecoration: 'line-through' }}>S</span>
                                </button>
                                <button type="button" className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => insertText('```', '```')}>
                                    <Type size={14} />
                                </button>
                                <div style={{ position: 'relative' }}>
                                    <button type="button" className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setShowEmojis(!showEmojis)}>
                                        <Smile size={14} />
                                    </button>
                                    {showEmojis && (
                                        <div style={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 100, marginBottom: 10 }}>
                                            <EmojiPicker
                                                onEmojiClick={(emojiData) => {
                                                    insertText(emojiData.emoji);
                                                    setShowEmojis(false);
                                                }}
                                                width={300}
                                                height={400}
                                                searchDisabled={false}
                                            />
                                        </div>
                                    )}
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <button type="button" className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => setShowVars(!showVars)}>
                                        <Code size={14} /> Variables
                                    </button>
                                    {showVars && (
                                        <div style={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 100, marginBottom: 10, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 8, minWidth: 200 }}>
                                            {!newVarModal ? (
                                                <>
                                                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 6, paddingLeft: 8, textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span>Insert Variable</span>
                                                        <button type="button" onClick={() => setNewVarModal(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                                            <PlusCircle size={14} />
                                                        </button>
                                                    </div>
                                                    {allVars.length > 5 && (
                                                        <div style={{ marginBottom: 8, padding: '0 4px' }}>
                                                            <input
                                                                type="text"
                                                                className="input"
                                                                placeholder="Search..."
                                                                value={varSearch}
                                                                onChange={e => setVarSearch(e.target.value)}
                                                                style={{ fontSize: 11, padding: '4px 8px', height: 28 }}
                                                            />
                                                        </div>
                                                    )}
                                                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                                                        {allVars.filter(v => v.toLowerCase().includes(varSearch.toLowerCase())).map(v => {
                                                            const isGlobal = globalVars.find(g => g.key === v);
                                                            return (
                                                                <div key={v} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-ghost"
                                                                        style={{ flex: 1, justifyContent: 'flex-start', padding: '6px 8px', fontSize: 12 }}
                                                                        onClick={() => {
                                                                            insertText(`{{${v}}}`);
                                                                            setShowVars(false);
                                                                        }}
                                                                    >
                                                                        <span style={{ color: 'var(--accent3)', fontWeight: 600, marginRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{`{{${v}}}`}</span>
                                                                    </button>
                                                                    {isGlobal && (
                                                                        <button
                                                                            type="button"
                                                                            title={`Edit ${v} (Current: ${isGlobal.value})`}
                                                                            style={{ background: 'none', border: 'none', padding: '4px 6px', color: 'var(--text3)', cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center' }}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setNewVar({ key: isGlobal.key, value: isGlobal.value });
                                                                                setNewVarModal(true);
                                                                            }}
                                                                        >
                                                                            <Edit3 size={13} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </>
                                            ) : (
                                                <div style={{ padding: 4 }}>
                                                    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>Create New Variable</div>
                                                    <input
                                                        className="input"
                                                        placeholder="Key (e.g. var1)"
                                                        style={{ fontSize: 12, padding: 6, marginBottom: 8, height: 32 }}
                                                        value={newVar.key}
                                                        onChange={e => setNewVar({ ...newVar, key: e.target.value })}
                                                    />
                                                    <input
                                                        className="input"
                                                        placeholder="Value (e.g. Discount50)"
                                                        style={{ fontSize: 12, padding: 6, marginBottom: 8, height: 32 }}
                                                        value={newVar.value}
                                                        onChange={e => setNewVar({ ...newVar, value: e.target.value })}
                                                    />
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button type="button" className="btn btn-ghost" style={{ flex: 1, padding: '4px', fontSize: 11 }} onClick={() => setNewVarModal(false)}>Cancel</button>
                                                        <button type="button" className="btn btn-primary" style={{ flex: 1, padding: '4px', fontSize: 11 }} onClick={handleCreateVar}>Save</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <textarea
                                id={`msg-input-${activeMsg}`}
                                className="textarea"
                                placeholder="Hello {{name}}, welcome to our service!"
                                value={messages[activeMsg]}
                                onChange={e => {
                                    const n = [...messages];
                                    n[activeMsg] = e.target.value;
                                    setMessages(n);
                                }}
                                onKeyDown={e => {
                                    if (e.ctrlKey && e.key === 'b') {
                                        e.preventDefault();
                                        insertText('*', '*');
                                    }
                                    if (e.ctrlKey && e.key === 'i') {
                                        e.preventDefault();
                                        insertText('_', '_');
                                    }
                                }}
                                required
                                style={{ minHeight: 180 }}
                            />
                            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                                💡 Tip: Use <code>{"{{name}}"}</code> to personalize your message if names are available.
                            </div>
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
                                    <label className="btn btn-ghost" style={{ flex: 1, height: 40, cursor: 'pointer', border: '1px dashed var(--border)' }}>
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
                                {form.mediaUrl && form.mediaUrl.startsWith('http') && (
                                    <div style={{ marginTop: 8, padding: 8, background: 'var(--bg3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <File size={16} color="var(--accent3)" />
                                        <span style={{ fontSize: 11, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {form.mediaUrl.split('/').pop()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={loading}
                                style={{ flex: 1, height: 46, fontSize: 15 }}
                            >
                                <Send size={18} />
                                {loading ? 'Starting...' : 'Start Sending Now'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Sidebar Settings */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div className="card" style={{ padding: 20 }}>
                        <h4 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                            <Clock size={16} color="var(--yellow)" /> Sending Options
                        </h4>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="label">Delay between messages (sec)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <input
                                    type="range"
                                    min="1"
                                    max="30"
                                    value={form.delay}
                                    onChange={e => setForm(f => ({ ...f, delay: parseInt(e.target.value) }))}
                                    style={{ flex: 1, accentColor: 'var(--accent)' }}
                                />
                                <span style={{ fontWeight: 700, minWidth: 24, textAlign: 'right', color: 'var(--accent3)' }}>{form.delay}s</span>
                            </div>
                            <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 8 }}>
                                Higher delay prevents WhatsApp from banning your account.
                            </p>
                        </div>
                    </div>

                    <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', padding: 16, borderRadius: 12, display: 'flex', gap: 12 }}>
                        <Zap size={20} color="var(--accent3)" style={{ flexShrink: 0 }} />
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Pro Hint</div>
                            <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>
                                You can track the live progress of this broadcast in the <a href="/campaigns" style={{ color: 'var(--accent3)', fontWeight: 600 }}>Campaigns</a> page.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
