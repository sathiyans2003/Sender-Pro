import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Send, Image, Users, MessageSquare, Clock, Zap, Upload, File, Bold, Italic, Type, Smile } from 'lucide-react';

export default function BulkSender() {
    const [messages, setMessages] = useState(['']);
    const [activeMsg, setActiveMsg] = useState(0);
    const [contacts, setContacts] = useState([]);
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
    }, []);

    const groups = [...new Set(contacts.map(c => {
        if (!c.group) return null;
        return typeof c.group === 'object' ? c.group.name : String(c.group);
    }).filter(Boolean))];

    const [showEmojis, setShowEmojis] = useState(false);
    const emojis = ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '🤨', '🤫', '🤝', '👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '👈', '👉', '👆', '👇', '✋', '🤚', '🖐', '🖖', '👋', '🤙', '💪', '🦾', '🖕', '✍️', '🙏', '💍', '💄', '👣', '👀', '👁', '👅', '👄', '💋', '🩸'];

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

                        {/* Message Tabs */}
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <label className="label" style={{ marginBottom: 0 }}>Message Contents *</label>
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
                                        <div style={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 100, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 10, width: 280, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 5, maxHeight: 200, overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', marginBottom: 10 }}>
                                            {emojis.map(e => (
                                                <div key={e} onClick={() => { insertText(e); setShowEmojis(false); }} style={{ cursor: 'pointer', fontSize: 18, textAlign: 'center', padding: 4, borderRadius: 4, transition: 'background 0.2s' }} className="hover:bg-gray-100">
                                                    {e}
                                                </div>
                                            ))}
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
                                style={{ minHeight: 100, fontSize: 12, fontFamily: 'monospace' }}
                            />
                            <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
                                Enter country code (e.g., 91). One per line.
                            </p>
                        </div>
                    </div>

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
