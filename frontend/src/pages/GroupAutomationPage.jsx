import React, { useEffect, useState, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Folder, FileText, X, ArrowLeft, Users2, Play, Pause, Trash2, Clock, Upload, Image, ArrowRight, Settings, Smile, Copy, ClipboardPaste, GripVertical } from 'lucide-react';

const COMMON_EMOJIS = ['😊', '😂', '❤️', '👍', '🙏', '🔥', '✨', '🎉', '✅', '❌', '🛑', '👇', '👉', '🚀', '💰'];

export default function GroupAutomationPage() {
    const [view, setView] = useState('projects'); // 'projects', 'automations', 'builder'

    // State Collections
    const [projects, setProjects] = useState([]);
    const [automations, setAutomations] = useState([]);
    const [groups, setGroups] = useState([]);

    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedAutomation, setSelectedAutomation] = useState(null);
    const [showAutoModal, setShowAutoModal] = useState(false);
    const [autoForm, setAutoForm] = useState({ name: '', triggerType: 'manual', scheduledAt: '' });
    const [previewData, setPreviewData] = useState(null);

    const [loading, setLoading] = useState(false);

    // ==================
    // 1. Projects View
    // ==================
    const loadProjects = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/automations/projects');
            setProjects(data);
        } catch (err) { toast.error('Failed to load projects'); }
        setLoading(false);
    }

    const createProject = async (e) => {
        e.preventDefault();
        const name = prompt("Enter Project Name:");
        if (!name) return;
        try {
            const { data } = await api.post('/automations/projects', { name });
            setProjects([data, ...projects]);
            toast.success("Project Created");
        } catch (err) { toast.error("Error creating project"); }
    }

    const openProject = (p) => {
        setSelectedProject(p);
        loadAutomations(p.id);
        setView('automations');
    }

    // ==================
    // 2. Automations View
    // ==================
    const formatDateTimeLocal = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    };

    const loadAutomations = async (projectId) => {
        setLoading(true);
        try {
            const { data } = await api.get(`/automations/projects/${projectId}/automations`);
            setAutomations(data);
        } catch (err) { toast.error('Failed to load automations'); }
        setLoading(false);
    }

    const createAutomation = async (e) => {
        e.preventDefault();
        const { name, triggerType, scheduledAt } = autoForm;
        if (!name) return toast.error("Enter Automation Name");
        if (triggerType === 'schedule' && !scheduledAt) return toast.error("Enter a date and time for schedule");

        try {
            const { data } = await api.post(`/automations/projects/${selectedProject.id}/automations`, { name, triggerType, scheduledAt });
            setAutomations([data, ...automations]);
            setShowAutoModal(false);
            setAutoForm({ name: '', triggerType: 'manual', scheduledAt: '' });
            toast.success("Automation Created");
        } catch (err) { toast.error("Error creating automation"); }
    }

    const openAutomation = async (a) => {
        setSelectedAutomation(a);
        try {
            const [grpRes, autoRes] = await Promise.all([
                api.get('/groups').catch(() => ({ data: [] })), // Gracefully handle no WhatsApp connection
                api.get(`/automations/${a.id}`)
            ]);
            if (grpRes.data && grpRes.data.length > 0) {
                setGroups(grpRes.data);
            }
            setSelectedAutomation(autoRes.data);
            setBuilderState({
                targetGroups: autoRes.data.targetGroups || [],
                steps: autoRes.data.steps || []
            });
            setView('builder');
        } catch (err) { toast.error('Error loading builder'); }
    }

    const handlePreview = async (a) => {
        try {
            const toastId = toast.loading('Loading preview...');
            const [autoRes, grpRes] = await Promise.all([
                api.get(`/automations/${a.id}`),
                groups.length === 0 ? api.get('/groups').catch(() => ({ data: [] })) : Promise.resolve({ data: groups })
            ]);
            toast.dismiss(toastId);

            if (groups.length === 0) setGroups(grpRes.data);

            const groupNames = autoRes.data.targetGroups.map(gid => {
                const g = grpRes.data.find(x => x.id === gid);
                return g ? g.name : gid;
            });

            setPreviewData({ ...autoRes.data, groupNames });
        } catch (err) { toast.error("Error loading preview"); }
    }

    const toggleAutomationStatusList = async (a, action) => {
        try {
            if (action === 'start') {
                const { data } = await api.post(`/automations/${a.id}/run`);
                toast.success(data.message);
            } else {
                await api.patch(`/automations/${a.id}/status`, { status: "paused" });
                toast.success("Paused");
            }
            loadAutomations(selectedProject.id);
        } catch (err) { toast.error("Execution error"); }
    }

    // ==================
    // 3. Automation Builder View
    // ==================
    const [builderState, setBuilderState] = useState({ targetGroups: [], steps: [] });
    const [groupSearch, setGroupSearch] = useState('');

    // Drag and Drop & Copy Paste states
    const [clipboardStep, setClipboardStep] = useState(null);
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    const handleDragStart = (e, position) => {
        dragItem.current = position;
    };

    const handleDragEnter = (e, position) => {
        dragOverItem.current = position;
    };

    const handleDragEnd = () => {
        if (
            Number.isInteger(dragItem.current) &&
            Number.isInteger(dragOverItem.current) &&
            dragItem.current !== dragOverItem.current &&
            dragItem.current >= 0 &&
            dragOverItem.current >= 0
        ) {
            setBuilderState(prev => {
                if (dragItem.current >= prev.steps.length || dragOverItem.current > prev.steps.length) return prev;

                const newSteps = [...prev.steps];
                const draggedItemContent = newSteps[dragItem.current];
                if (!draggedItemContent) return prev; // Safety check

                newSteps.splice(dragItem.current, 1);
                newSteps.splice(dragOverItem.current, 0, draggedItemContent);
                return { ...prev, steps: newSteps };
            });
        }
        dragItem.current = null;
        dragOverItem.current = null;
    };

    const copyStep = (step) => {
        setClipboardStep({ ...step });
        toast.success("Step Copied");
    };

    const pasteStep = (idx) => {
        if (!clipboardStep) return;
        setBuilderState(prev => {
            const newSteps = [...prev.steps];
            newSteps.splice(idx + 1, 0, { ...clipboardStep });
            return { ...prev, steps: newSteps };
        });
        toast.success("Step Pasted");
    };

    const toggleGroup = (id) => {
        setBuilderState(prev => {
            const tg = prev.targetGroups;
            return { ...prev, targetGroups: tg.includes(id) ? tg.filter(x => x !== id) : [...tg, id] };
        });
    }

    const addStep = (type) => {
        setBuilderState(prev => ({
            ...prev,
            steps: [...prev.steps, { actionType: type, message: '', delayValue: 0, delayUnit: 'minutes', delayOption: 'duration', delayUntilDate: '' }]
        }));
    }

    const handleStepFileUpload = async (e, idx) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const toastId = toast.loading('Uploading file...');
            try {
                const base64 = reader.result;
                const { data } = await api.post('/upload', {
                    base64,
                    filename: file.name,
                    fileType: file.type
                });
                updateStep(idx, 'mediaUrl', data.url);
                toast.success('File uploaded successfully!', { id: toastId });
            } catch (err) {
                toast.error('File upload failed', { id: toastId });
            }
        };
    };

    const updateStep = (idx, field, val) => {
        setBuilderState(prev => {
            const newSteps = [...prev.steps];
            newSteps[idx] = { ...newSteps[idx], [field]: val };
            return { ...prev, steps: newSteps };
        })
    }

    const removeStep = (idx) => {
        setBuilderState(prev => ({
            ...prev, steps: prev.steps.filter((_, i) => i !== idx)
        }));
    }

    const saveWorkflow = async () => {
        try {
            await api.patch(`/automations/${selectedAutomation.id}/trigger`, {
                triggerType: selectedAutomation.triggerType,
                scheduledAt: selectedAutomation.scheduledAt
            });
            await api.post(`/automations/${selectedAutomation.id}/steps`, { steps: builderState.steps });
            await api.patch(`/automations/${selectedAutomation.id}/groups`, { targetGroups: builderState.targetGroups });
            toast.success("Workflow Saved Successfully");
        } catch (err) { toast.error("Error saving workflow"); }
    }

    const startExecution = async () => {
        try {
            await saveWorkflow(); // Save UI settings first (like start time & date)
            const { data } = await api.post(`/automations/${selectedAutomation.id}/run`);
            toast.success(data.message);
            setSelectedAutomation(prev => ({ ...prev, status: 'active' }));
        } catch (err) { toast.error("Execution error"); }
    }

    const pauseExecution = async () => {
        try {
            const { data } = await api.patch(`/automations/${selectedAutomation.id}/status`, { status: "paused" });
            toast.success("Paused");
            setSelectedAutomation(prev => ({ ...prev, status: 'paused' }));
        } catch (err) { }
    }

    useEffect(() => { loadProjects(); }, []);

    return (
        <div className="fade-in">
            {/* Header */}
            <div className="page-header" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                    {view !== 'projects' && (
                        <button className="btn btn-ghost" style={{ padding: 8 }} onClick={() => {
                            if (view === 'builder') {
                                loadAutomations(selectedProject.id);
                                setView('automations');
                            } else {
                                setView('projects');
                            }
                        }}>
                            <ArrowLeft size={18} />
                        </button>
                    )}
                    <div>
                        <div className="page-title">
                            {view === 'projects' && 'Automations'}
                            {view === 'automations' && `Project: ${selectedProject?.name}`}
                            {view === 'builder' && `Workflow: ${selectedAutomation?.name}`}
                        </div>
                        <div className="page-sub">GHL Style Multi-Group Setup</div>
                    </div>
                </div>

                {view === 'projects' && <button className="btn btn-primary" onClick={createProject}><Plus size={14} /> New Project</button>}
                {view === 'automations' && <button className="btn btn-primary" onClick={() => setShowAutoModal(true)}><Plus size={14} /> New Automation</button>}
                {view === 'builder' && (
                    <div style={{ display: 'flex', gap: 10 }}>
                        {selectedAutomation?.status === 'active' ? (
                            <button className="btn btn-ghost" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={pauseExecution}><Pause size={14} /> Pause</button>
                        ) : (
                            <button className="btn btn-success" style={{ background: 'var(--green)', color: 'white' }} onClick={startExecution}><Play size={14} /> Run Now</button>
                        )}
                        <button className="btn btn-primary" onClick={saveWorkflow}>Save Workflow</button>
                    </div>
                )}
            </div>

            {loading && <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div>}

            {/* View 1: Projects */}
            {!loading && view === 'projects' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 15 }}>
                    {projects.map(p => (
                        <div key={p.id} className="card" style={{ cursor: 'pointer', transition: '0.2s', border: '1px solid var(--border)' }} onClick={() => openProject(p)}>
                            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                                <div style={{ width: 45, height: 45, borderRadius: 12, background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Folder size={20} color="var(--accent)" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>Created: {new Date(p.createdAt).toLocaleDateString()}</div>
                                </div>
                                <ArrowRight size={16} color="var(--text3)" />
                            </div>
                        </div>
                    ))}
                    {projects.length === 0 && <div className="empty-state">No projects yet. Create one!</div>}
                </div>
            )}

            {/* View 2: Automations List */}
            {!loading && view === 'automations' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {automations.map(a => (
                        <div key={a.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FileText size={18} color="var(--accent3)" />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>{a.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'flex', gap: 15 }}>
                                    <span><b>Status:</b> <span style={{ color: a.status === 'active' ? 'var(--green)' : a.status === 'completed' ? 'var(--accent)' : 'var(--red)' }}>{a.status.toUpperCase()}</span></span>
                                    <span><b>Type:</b> {a.triggerType.toUpperCase()}</span>
                                    {a.triggerType === 'schedule' && a.scheduledAt && (
                                        <span><b>Scheduled For:</b> {new Date(a.scheduledAt).toLocaleString()}</span>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {a.status === 'active' ? (
                                    <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12, border: '1px solid var(--red)', color: 'var(--red)' }} onClick={() => toggleAutomationStatusList(a, 'pause')}><Pause size={14} /> Pause</button>
                                ) : (
                                    <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12, border: '1px solid var(--green)', color: 'var(--green)' }} onClick={() => toggleAutomationStatusList(a, 'start')}><Play size={14} /> Run Now</button>
                                )}
                                <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12, border: '1px solid var(--border)' }} onClick={() => handlePreview(a)}><FileText size={14} /> Preview</button>
                                <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12, border: '1px solid var(--border)' }} onClick={() => openAutomation(a)}><Settings size={14} /> Builder</button>
                            </div>
                        </div>
                    ))}
                    {automations.length === 0 && <div className="empty-state">No automations found. Create one.</div>}
                </div>
            )}

            {/* View 3: Visual Workflow Builder */}
            {!loading && view === 'builder' && (
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

                    {/* Groups Sidebar */}
                    <div className="card" style={{ width: 320, flexShrink: 0, height: 'calc(100vh - 150px)', overflowY: 'auto' }}>
                        <h4 style={{ marginBottom: 10, fontSize: 13, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>1. Target Groups ({builderState.targetGroups.length} selected)</h4>
                        <input className="input" placeholder="Search Groups..." value={groupSearch} onChange={e => setGroupSearch(e.target.value)} style={{ marginBottom: 10 }} />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {groups.filter(g => (g.name || '').toLowerCase().includes(groupSearch.toLowerCase())).map(g => (
                                <label key={g.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 8px', borderRadius: 8, background: 'var(--bg3)', cursor: 'pointer', gap: 10 }}>
                                    <input type="checkbox" checked={builderState.targetGroups.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                                    <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13 }}>
                                        {g.name}
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Canvas Area */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 'calc(100vh - 150px)', padding: 20, background: 'var(--bg3)', borderRadius: 16 }}>
                        <h4 style={{ marginBottom: 20, color: 'var(--text3)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>2. Workflow Steps</h4>

                        <div style={{ width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column', gap: 15, position: 'relative' }}>
                            {/* Workflow Trigger / Start Block */}
                            <div className="card fade-in" style={{ border: '1px solid var(--accent)', background: 'var(--bg2)', boxShadow: '0 4px 15px rgba(124,58,237,0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)', marginBottom: 15 }}>
                                    <Play size={16} /> <b>Flow Start Setting</b>
                                </div>
                                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                                    <button type="button" className={`btn ${selectedAutomation?.triggerType === 'manual' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setSelectedAutomation({ ...selectedAutomation, triggerType: 'manual' })}>Manual Run</button>
                                    <button type="button" className={`btn ${selectedAutomation?.triggerType === 'schedule' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setSelectedAutomation({ ...selectedAutomation, triggerType: 'schedule' })}>Specific Date</button>
                                </div>
                                {selectedAutomation?.triggerType === 'schedule' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: 11, color: 'var(--text3)' }}>Start automatically on date & time:</label>
                                        <input type="datetime-local" className="input" value={selectedAutomation?.scheduledAt ? formatDateTimeLocal(selectedAutomation.scheduledAt) : ''} onChange={e => setSelectedAutomation({ ...selectedAutomation, scheduledAt: e.target.value })} />
                                    </div>
                                )}
                            </div>

                            {/* Divider Line */}
                            <div style={{ width: 2, height: 20, background: 'var(--border)', margin: '0 auto' }}></div>

                            {builderState.steps.map((step, idx) => (
                                <div
                                    key={idx}
                                    className="card fade-in"
                                    style={{ position: 'relative', border: '1px solid var(--border)', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', opacity: dragItem.current === idx ? 0.5 : 1 }}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, idx)}
                                    onDragEnter={(e) => handleDragEnter(e, idx)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => e.preventDefault()}
                                >
                                    <div style={{ position: 'absolute', top: -10, left: 15, background: 'var(--bg2)', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 'bold', color: 'var(--accent)', zIndex: 2 }}>
                                        Step {idx + 1}
                                    </div>

                                    <div style={{ position: 'absolute', top: 10, left: -25, color: 'var(--text3)', cursor: 'grab' }}>
                                        <GripVertical size={18} />
                                    </div>

                                    <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 8 }}>
                                        <button onClick={() => copyStep(step)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }} title="Copy Step"><Copy size={13} /></button>
                                        {clipboardStep && <button onClick={() => pasteStep(idx)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }} title="Paste Below"><ClipboardPaste size={15} /></button>}
                                        <button onClick={() => removeStep(idx)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer' }}><X size={14} /></button>
                                    </div>

                                    {step.actionType === 'send_message' && (
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--accent)' }}><FileText size={16} /> <b>Send Message</b></div>

                                            <textarea className="textarea" placeholder="Enter message here..." value={step.message} onChange={e => updateStep(idx, 'message', e.target.value)} style={{ minHeight: 80, resize: 'vertical' }} />

                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, padding: 8, background: 'var(--bg2)', borderRadius: 8 }}>
                                                <Smile size={14} color="var(--text3)" style={{ marginTop: 4, marginRight: 4 }} />
                                                {COMMON_EMOJIS.map(emoji => (
                                                    <button key={emoji} type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
                                                        onClick={() => updateStep(idx, 'message', step.message + emoji)}
                                                    >{emoji}</button>
                                                ))}
                                            </div>

                                            <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', background: 'var(--bg2)', padding: '10px', borderRadius: 8 }}>
                                                <label className="btn btn-ghost" style={{ border: '1px dashed var(--border)', cursor: 'pointer', padding: '6px 12px', fontSize: 12 }}>
                                                    <Upload size={14} /> Upload Media
                                                    <input type="file" onChange={(e) => handleStepFileUpload(e, idx)} hidden />
                                                </label>
                                                {step.mediaUrl ? (
                                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' }}>
                                                        <span style={{ fontSize: 11, color: 'var(--accent)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>{step.mediaUrl.split('/').pop()}</span>
                                                        <button type="button" onClick={() => updateStep(idx, 'mediaUrl', '')} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 11 }}><Trash2 size={13} /></button>
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>No file attached.</span>
                                                )}
                                            </div>

                                        </div>
                                    )}

                                    {step.actionType === 'delay' && (
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--yellow)' }}>
                                                    <Clock size={16} /> <b>Wait / Delay</b>
                                                </div>
                                                <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 20, padding: 2 }}>
                                                    <button type="button" onClick={() => updateStep(idx, 'delayOption', 'duration')} className="btn btn-ghost" style={{ padding: '2px 10px', fontSize: 11, borderRadius: 20, background: step.delayOption !== 'exact_time' ? 'var(--yellow)' : 'transparent', color: step.delayOption !== 'exact_time' ? '#000' : 'var(--text3)', border: 'none' }}>Duration</button>
                                                    <button type="button" onClick={() => updateStep(idx, 'delayOption', 'exact_time')} className="btn btn-ghost" style={{ padding: '2px 10px', fontSize: 11, borderRadius: 20, background: step.delayOption === 'exact_time' ? 'var(--yellow)' : 'transparent', color: step.delayOption === 'exact_time' ? '#000' : 'var(--text3)', border: 'none' }}>Exact Date</button>
                                                </div>
                                            </div>

                                            {step.delayOption === 'exact_time' ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                    <label style={{ fontSize: 11, color: 'var(--text3)' }}>Wait until specific date & time:</label>
                                                    <input type="datetime-local" className="input" value={step.delayUntilDate ? formatDateTimeLocal(step.delayUntilDate) : ''} onChange={e => updateStep(idx, 'delayUntilDate', e.target.value)} />
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <input type="number" className="input" style={{ width: 80 }} value={step.delayValue || step.delayMinutes || 0} onChange={e => updateStep(idx, 'delayValue', Number(e.target.value))} />
                                                    <select className="input" style={{ width: 120 }} value={step.delayUnit || 'minutes'} onChange={e => updateStep(idx, 'delayUnit', e.target.value)}>
                                                        <option value="minutes">Minutes</option>
                                                        <option value="hours">Hours</option>
                                                        <option value="days">Days</option>
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}

                            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 10 }}>
                                <button className="btn btn-ghost" style={{ border: '1px dashed var(--accent)', color: 'var(--text)' }} onClick={() => addStep('send_message')}><Plus size={14} /> Message Action</button>
                                <button className="btn btn-ghost" style={{ border: '1px dashed var(--yellow)', color: 'var(--text)' }} onClick={() => addStep('delay')}><Clock size={14} /> Time Delay</button>
                                {clipboardStep && builderState.steps.length === 0 && (
                                    <button className="btn btn-ghost" style={{ border: '1px dashed var(--green)', color: 'var(--text)' }} onClick={() => pasteStep(-1)}><ClipboardPaste size={14} /> Paste Step</button>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* Modal for creating a new Automation */}
            {showAutoModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
                    <div className="card fade-in" style={{ width: '100%', maxWidth: 450, margin: 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <h3 style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 17 }}>Create New Automation</h3>
                            <button onClick={() => setShowAutoModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={18} /></button>
                        </div>
                        <form onSubmit={createAutomation}>
                            <div className="form-group">
                                <label className="label">Automation Name</label>
                                <input className="input" placeholder="e.g. Daily Offer" value={autoForm.name} onChange={e => setAutoForm({ ...autoForm, name: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="label">Trigger Type</label>
                                <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                                    <button type="button" className={`btn ${autoForm.triggerType === 'manual' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setAutoForm({ ...autoForm, triggerType: 'manual' })}>Manual (Run Now)</button>
                                    <button type="button" className={`btn ${autoForm.triggerType === 'schedule' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setAutoForm({ ...autoForm, triggerType: 'schedule' })}>Scheduled Time</button>
                                </div>
                            </div>
                            {autoForm.triggerType === 'schedule' && (
                                <div className="form-group">
                                    <label className="label">Select Date & Time</label>
                                    <input type="datetime-local" className="input" value={autoForm.scheduledAt ? formatDateTimeLocal(autoForm.scheduledAt) : ''} onChange={e => setAutoForm({ ...autoForm, scheduledAt: e.target.value })} required />
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowAutoModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {previewData && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
                    <div className="card fade-in" style={{ width: '100%', maxWidth: 500, margin: 'auto', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <h3 style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 17 }}>Preview: {previewData.name}</h3>
                            <button onClick={() => setPreviewData(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={18} /></button>
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 5 }}>
                            <div style={{ marginBottom: 15, padding: 10, background: 'var(--bg2)', borderRadius: 8, fontSize: 13 }}>
                                <div><b>Trigger:</b> {previewData.triggerType.toUpperCase()}</div>
                                {previewData.triggerType === 'schedule' && previewData.scheduledAt && (
                                    <div style={{ marginTop: 5 }}><b>Starts At:</b> {new Date(previewData.scheduledAt).toLocaleString()}</div>
                                )}
                                <div style={{ marginTop: 5 }}>
                                    <b>Target Groups:</b> {previewData.targetGroups.length} selected
                                    {previewData.groupNames && previewData.groupNames.length > 0 && (
                                        <div style={{ marginTop: 4, color: 'var(--text3)', fontSize: 11 }}>
                                            {previewData.groupNames.join(', ')}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {previewData.steps && previewData.steps.length > 0 ? previewData.steps.map((step, idx) => (
                                    <div key={idx} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
                                        <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--accent)', marginBottom: 8 }}># STEP {idx + 1}</div>
                                        {step.actionType === 'send_message' && (
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)', fontSize: 13, marginBottom: 5 }}><FileText size={14} /> <b>Send Message</b></div>
                                                {step.mediaUrl && <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 5 }}>[Contains Media]</div>}
                                                <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', background: 'var(--bg2)', padding: 10, borderRadius: 6 }}>{step.message || <i>(No text content)</i>}</div>
                                            </div>
                                        )}
                                        {step.actionType === 'delay' && (
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--yellow)', fontSize: 13, marginBottom: 5 }}><Clock size={14} /> <b>Wait / Delay</b></div>
                                                <div style={{ fontSize: 13 }}>
                                                    {step.delayOption === 'exact_time' && step.delayUntilDate
                                                        ? `Until ${new Date(step.delayUntilDate).toLocaleString()}`
                                                        : `For ${step.delayValue || step.delayMinutes} ${step.delayUnit || 'minutes'}`
                                                    }
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )) : (
                                    <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)', fontSize: 13 }}>No steps configured yet.</div>
                                )}
                            </div>
                        </div>
                        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={() => setPreviewData(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
