import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Flag, Upload, Edit, Trash2, GitBranch, UserPlus, CheckCircle, Clock, XCircle, Users, Loader2, Save, AlertCircle, ExternalLink, Edit3, ChevronDown, ChevronUp, Copy, Crop, Rocket, ArrowRight, Settings } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import AdminEditRequests from '@/components/admin/AdminEditRequests';
import AdminEventEditor from '@/components/admin/AdminEventEditor';
import AdminDuplicateReview from '@/components/admin/AdminDuplicateReview';
import GoLiveTaskCard from '@/components/GoLiveTaskCard';

const actionIcons = {
  upload: Upload,
  edit: Edit,
  delete: Trash2,
  branch_create: GitBranch,
  conflict_flag: Flag,
  registration: UserPlus,
  conflict_resolve: CheckCircle,
  approval: CheckCircle,
};

const statusBadges = {
  open: { label: 'Open', class: 'bg-[#8B6914]/30 text-amber-light border-[rgba(201,145,58,0.3)]' },
  resolved: { label: 'Resolved', class: 'bg-green-900/20 text-green-400 border-green-800/30' },
  dismissed: { label: 'Dismissed', class: 'bg-[rgba(245,236,215,0.05)] text-parchment/40 border-[rgba(245,236,215,0.1)]' },
};

export default function AdminDashboard() {
  const [logs, setLogs] = useState([]);
  const [flags, setFlags] = useState([]);
  const [newAncestors, setNewAncestors] = useState([]);
  const [flaggedItems, setFlaggedItems] = useState([]);
  const [editRequestCount, setEditRequestCount] = useState(0);
  const [tab, setTab] = useState('activity');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [expandedFlaggedId, setExpandedFlaggedId] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.ActivityLog.list('-created_date', 50),
      base44.entities.ConflictFlag.filter({ status: 'open' }),
      base44.entities.Ancestor.filter({ review_status: 'auto_approved' }),
      base44.entities.ContentItem.filter({ review_status: 'flagged' }),
      base44.entities.EditRequest.filter({ status: 'pending' }),
    ]).then(([lg, fl, na, fi, er]) => {
      setLogs(lg || []);
      setFlags(fl || []);
      setNewAncestors(na || []);
      setFlaggedItems(fi || []);
      setEditRequestCount((er || []).length);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const startEdit = (ancestor) => {
    setEditingId(ancestor.id);
    setEditForm({
      full_name: ancestor.full_name || '',
      birth_date: ancestor.birth_date || '',
      birth_place: ancestor.birth_place || '',
      death_date: ancestor.death_date || '',
      death_place: ancestor.death_place || '',
      nationality: ancestor.nationality || '',
      biography: ancestor.biography || '',
      living: ancestor.living !== false,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSaveEdit = async (ancestorId) => {
    setSavingEdit(true);
    try {
      const surname = editForm.full_name.trim().split(/\s+/).pop().toUpperCase();
      const givenNames = editForm.full_name.trim().split(/\s+/).slice(0, -1).join(' ');
      const formattedName = `${givenNames} ${surname}`.trim();

      await base44.entities.Ancestor.update(ancestorId, {
        ...editForm,
        full_name: formattedName,
        review_status: 'overwritten',
      });
      setNewAncestors(prev => prev.filter(a => a.id !== ancestorId));
      setEditingId(null);
      setEditForm({});
    } catch (e) {}
    setSavingEdit(false);
  };

  const handleVerify = async (ancestorId) => {
    try {
      await base44.entities.Ancestor.update(ancestorId, { review_status: 'admin_verified' });
      setNewAncestors(prev => prev.filter(a => a.id !== ancestorId));
    } catch (e) {}
  };

  const resolveFlaggedItem = async (itemId) => {
    try {
      await base44.entities.ContentItem.update(itemId, { review_status: 'reviewed' });
      setFlaggedItems(prev => prev.filter(i => i.id !== itemId));
    } catch (e) {}
  };

  const resolveFlag = async (flagId, resolution) => {
    try {
      await base44.entities.ConflictFlag.update(flagId, {
        status: resolution,
        resolution_note: resolution === 'resolved' ? 'Resolved by admin' : 'Dismissed by admin',
      });
      setFlags(flags.filter(f => f.id !== flagId));
    } catch (e) {}
  };

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-12 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center">
            <Activity size={24} className="text-gold" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-parchment">Admin Dashboard</h1>
            <p className="text-parchment/50 text-sm">Monitor activity and resolve conflicts across the archive</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Total Actions', value: logs.length, icon: Activity },
            { label: 'Uploads', value: logs.filter(l => l.action_type === 'upload').length, icon: Upload },
            { label: 'Open Flags', value: flags.length, icon: Flag },
            { label: 'Flagged Uploads', value: flaggedItems.length, icon: AlertCircle },
            { label: 'Edit Requests', value: editRequestCount, icon: Edit3 },
            { label: 'New Ancestors', value: newAncestors.length, icon: Users },
            { label: 'Branches', value: logs.filter(l => l.action_type === 'branch_create').length, icon: GitBranch },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="aged-card rounded-xl p-5">
                <Icon size={20} className="text-gold/60 mb-2" />
                <p className="font-display text-3xl text-parchment">{stat.value}</p>
                <p className="text-xs text-parchment/40 mt-1">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab('activity')}
            className={`px-4 py-2 rounded-lg text-sm transition-all border ${tab === 'activity' ? 'bg-[rgba(201,145,58,0.12)] text-gold border-[rgba(201,145,58,0.3)]' : 'text-parchment/50 border-[rgba(201,145,58,0.1)]'}`}>
            Activity Log
          </button>
          <button onClick={() => setTab('flags')}
            className={`px-4 py-2 rounded-lg text-sm transition-all border ${tab === 'flags' ? 'bg-[rgba(201,145,58,0.12)] text-gold border-[rgba(201,145,58,0.3)]' : 'text-parchment/50 border-[rgba(201,145,58,0.1)]'}`}>
            Conflict Flags {flags.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#8B6914] text-amber-light text-xs">{flags.length}</span>}
          </button>
          <button onClick={() => setTab('flagged')}
            className={`px-4 py-2 rounded-lg text-sm transition-all border ${tab === 'flagged' ? 'bg-[rgba(201,145,58,0.12)] text-gold border-[rgba(201,145,58,0.3)]' : 'text-parchment/50 border-[rgba(201,145,58,0.1)]'}`}>
            Flagged Uploads {flaggedItems.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#8B6914] text-amber-light text-xs">{flaggedItems.length}</span>}
          </button>
          <button onClick={() => setTab('edits')}
            className={`px-4 py-2 rounded-lg text-sm transition-all border ${tab === 'edits' ? 'bg-[rgba(201,145,58,0.12)] text-gold border-[rgba(201,145,58,0.3)]' : 'text-parchment/50 border-[rgba(201,145,58,0.1)]'}`}>
            Edit Requests {editRequestCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#8B6914] text-amber-light text-xs">{editRequestCount}</span>}
          </button>
          <button onClick={() => setTab('ancestors')}
            className={`px-4 py-2 rounded-lg text-sm transition-all border ${tab === 'ancestors' ? 'bg-[rgba(201,145,58,0.12)] text-gold border-[rgba(201,145,58,0.3)]' : 'text-parchment/50 border-[rgba(201,145,58,0.1)]'}`}>
            New Ancestors {newAncestors.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#8B6914] text-amber-light text-xs">{newAncestors.length}</span>}
          </button>
          <button onClick={() => setTab('duplicates')}
            className={`px-4 py-2 rounded-lg text-sm transition-all border ${tab === 'duplicates' ? 'bg-[rgba(201,145,58,0.12)] text-gold border-[rgba(201,145,58,0.3)]' : 'text-parchment/50 border-[rgba(201,145,58,0.1)]'}`}>
            Merge Duplicates
          </button>
          <button onClick={() => setTab('setup')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-all border ${tab === 'setup' ? 'bg-[rgba(201,145,58,0.12)] text-gold border-[rgba(201,145,58,0.3)]' : 'text-parchment/50 border-[rgba(201,145,58,0.1)]'}`}>
            <Settings size={14} /> Setup
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="aged-card rounded-lg h-16 animate-pulse" />)}</div>
        ) : tab === 'activity' ? (
          <div className="aged-card rounded-2xl overflow-hidden">
            {logs.length > 0 ? (
              <div className="divide-y divide-[rgba(201,145,58,0.08)]">
                {logs.map(log => {
                  const Icon = actionIcons[log.action_type] || Activity;
                  return (
                    <div key={log.id} className="flex items-center gap-4 p-4 hover:bg-[rgba(201,145,58,0.03)] transition-colors">
                      <div className="w-9 h-9 rounded-lg bg-[rgba(201,145,58,0.08)] flex items-center justify-center flex-shrink-0">
                        <Icon size={16} className="text-gold" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-parchment">{log.description}</p>
                        <div className="flex items-center gap-3 text-xs text-parchment/40 mt-0.5">
                          {log.user_name && <span>{log.user_name}</span>}
                          {log.created_date && <span>{new Date(log.created_date).toLocaleString('en-AU')}</span>}
                        </div>
                      </div>
                      <span className="text-xs text-parchment/40 capitalize hidden sm:block px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.06)]">{log.action_type.replace(/_/g, ' ')}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="p-8 text-center text-parchment/50 text-sm">No activity recorded yet.</p>
            )}
          </div>
        ) : tab === 'flagged' ? (
          <div className="space-y-4">
            {flaggedItems.length > 0 ? (
              flaggedItems.map(item => {
                const isExpanded = expandedFlaggedId === item.id;
                return (
                <div key={item.id} className="aged-card rounded-xl">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={18} className="text-amber-light" />
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-[#8B6914]/30 text-amber-light border-[rgba(201,145,58,0.3)]">
                          Flagged — Incomplete Data
                        </span>
                      </div>
                      <span className="text-xs text-parchment/40">{item.created_date ? new Date(item.created_date).toLocaleString('en-AU') : ''}</span>
                    </div>
                    <h3 className="font-display text-lg text-parchment mb-1">{item.title || 'Untitled'}</h3>
                    <p className="text-sm text-parchment/50 mb-3">Type: {item.content_type?.replace(/_/g, ' ') || 'uncategorized'}</p>

                    {/* Show what's missing */}
                    <div className="space-y-1 mb-3">
                      {!item.ancestor_ids?.length && <p className="text-xs text-red-400/70 flex items-center gap-1.5"><AlertCircle size={12} /> No ancestor tagged</p>}
                      {!item.location_name?.trim() && <p className="text-xs text-red-400/70 flex items-center gap-1.5"><AlertCircle size={12} /> No event location provided</p>}
                      {!item.date && <p className="text-xs text-red-400/70 flex items-center gap-1.5"><AlertCircle size={12} /> No event date provided</p>}
                      {!item.title?.trim() && <p className="text-xs text-red-400/70 flex items-center gap-1.5"><AlertCircle size={12} /> No title/description provided</p>}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setExpandedFlaggedId(isExpanded ? null : item.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[rgba(201,145,58,0.06)] text-amber-light border border-[rgba(201,145,58,0.12)] hover:bg-[rgba(201,145,58,0.12)] transition-colors text-xs font-medium">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {isExpanded ? 'Collapse' : 'Review & Edit'}
                      </button>
                      <Link to={`/content/${item.id}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-xs font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors">
                        <ExternalLink size={14} /> View & Edit
                      </Link>
                      <button onClick={() => resolveFlaggedItem(item.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-900/20 text-green-400 text-xs border border-green-800/30 hover:bg-green-900/30 transition-colors">
                        <CheckCircle size={14} /> Mark Reviewed
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-[rgba(201,145,58,0.12)] p-5">
                      <AdminEventEditor item={item} onApproved={(id) => { setFlaggedItems(prev => prev.filter(i => i.id !== id)); setExpandedFlaggedId(null); }} />
                    </div>
                  )}
                </div>
                );
              })
            ) : (
              <div className="aged-card rounded-xl p-12 text-center">
                <AlertCircle size={32} className="text-gold/30 mx-auto mb-3" />
                <p className="text-parchment/50">No flagged uploads awaiting review.</p>
              </div>
            )}
          </div>
        ) : tab === 'edits' ? (
          <AdminEditRequests />
        ) : tab === 'duplicates' ? (
          <AdminDuplicateReview duplicates={[]} />
        ) : tab === 'ancestors' ? (
          <div className="space-y-4">
            {newAncestors.length > 0 ? (
              newAncestors.map(ancestor => (
                <div key={ancestor.id} className="aged-card rounded-xl p-5">
                  {editingId === ancestor.id ? (
                    /* ── Inline edit form ── */
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Edit size={16} className="text-gold" />
                        <span className="text-sm text-parchment font-medium">Overwrite Ancestor Details</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-parchment/40 mb-1 block">Full Name</label>
                          <input value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                            className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]" />
                        </div>
                        <div>
                          <label className="text-xs text-parchment/40 mb-1 block">Nationality</label>
                          <input value={editForm.nationality} onChange={e => setEditForm({ ...editForm, nationality: e.target.value })}
                            className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]" />
                        </div>
                        <div>
                          <label className="text-xs text-parchment/40 mb-1 block">Birth Date</label>
                          <input type="date" value={editForm.birth_date} onChange={e => setEditForm({ ...editForm, birth_date: e.target.value })}
                            className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]" />
                        </div>
                        <div>
                          <label className="text-xs text-parchment/40 mb-1 block">Death Date</label>
                          <input type="date" value={editForm.death_date} onChange={e => setEditForm({ ...editForm, death_date: e.target.value })}
                            className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]" />
                        </div>
                        <div>
                          <label className="text-xs text-parchment/40 mb-1 block">Birth Place</label>
                          <input value={editForm.birth_place} onChange={e => setEditForm({ ...editForm, birth_place: e.target.value })}
                            className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]" />
                        </div>
                        <div>
                          <label className="text-xs text-parchment/40 mb-1 block">Death Place</label>
                          <input value={editForm.death_place} onChange={e => setEditForm({ ...editForm, death_place: e.target.value })}
                            className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-parchment/40 mb-1 block">Biography</label>
                        <textarea value={editForm.biography} onChange={e => setEditForm({ ...editForm, biography: e.target.value })} rows={2}
                          className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-3 py-2 text-sm text-parchment focus:outline-none focus:border-[#C9913A]" />
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button onClick={cancelEdit} className="px-3 py-1.5 rounded-lg text-xs text-parchment/50 border border-[rgba(245,236,215,0.1)] hover:bg-[rgba(245,236,215,0.05)] transition-colors">
                          Cancel
                        </button>
                        <button onClick={() => handleSaveEdit(ancestor.id)} disabled={savingEdit || !editForm.full_name.trim()}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#C9913A] text-charcoal text-xs font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity">
                          {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Overwrite
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Ancestor summary card ── */
                    <>
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] flex items-center justify-center text-sm text-gold font-medium">
                            {ancestor.full_name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm text-parchment font-medium">{ancestor.full_name}</p>
                            <div className="flex items-center gap-2 text-xs text-parchment/40 mt-0.5">
                              {ancestor.birth_date && <span>b. {new Date(ancestor.birth_date).getFullYear()}</span>}
                              {ancestor.birth_place && <span>· {ancestor.birth_place}</span>}
                              {ancestor.nationality && <span>· {ancestor.nationality}</span>}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-[rgba(201,145,58,0.08)] text-amber-light border-[rgba(201,145,58,0.2)]">
                          Auto-approved
                        </span>
                      </div>
                      {ancestor.biography && (
                        <p className="text-xs text-parchment/50 mb-3">{ancestor.biography}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-parchment/40 mb-3">
                        <UserPlus size={12} />
                        Added by <span className="text-amber-light/70">{ancestor.created_by_name || 'Unknown'}</span>
                        {ancestor.created_date && <span>· {new Date(ancestor.created_date).toLocaleDateString('en-AU')}</span>}
                      </div>
                      <div className="flex gap-2">
                        <Link to={`/ancestor/${ancestor.id}`} className="px-3 py-1.5 rounded-lg bg-[rgba(201,145,58,0.06)] border border-[rgba(201,145,58,0.15)] text-amber-light/80 text-xs hover:border-[rgba(201,145,58,0.35)] transition-colors">
                          View Profile
                        </Link>
                        <button onClick={() => startEdit(ancestor)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,145,58,0.1)] border border-[rgba(201,145,58,0.2)] text-amber-light text-xs font-medium hover:bg-[rgba(201,145,58,0.15)] transition-colors">
                          <Edit size={14} /> Overwrite
                        </button>
                        <button onClick={() => handleVerify(ancestor.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-900/20 text-green-400 text-xs border border-green-800/30 hover:bg-green-900/30 transition-colors">
                          <CheckCircle size={14} /> Verify
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            ) : (
              <div className="aged-card rounded-xl p-12 text-center">
                <Users size={32} className="text-gold/30 mx-auto mb-3" />
                <p className="text-parchment/50">No new ancestors awaiting review.</p>
              </div>
            )}
          </div>
        ) : tab === 'setup' ? (
          <div className="space-y-5">
            <GoLiveTaskCard />
            <Link to="/crop-reedit" className="block aged-card rounded-xl p-5 hover:border-[rgba(201,145,58,0.45)] transition-colors group">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-[rgba(201,145,58,0.12)] border border-[rgba(201,145,58,0.25)] flex items-center justify-center flex-shrink-0">
                  <Crop size={20} className="text-gold" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(201,145,58,0.12)] text-amber-light border border-[rgba(201,145,58,0.2)] font-medium">ADMIN SETUP</span>
                    <span className="text-xs text-parchment/30">Permanent tool</span>
                  </div>
                  <p className="text-sm text-parchment font-medium mb-1">Re-edit Image Cropping</p>
                  <p className="text-xs text-parchment/50">Re-adjust the focal point and crop box for any image across the archive so cards and hero displays frame subjects correctly.</p>
                </div>
                <ArrowRight size={18} className="text-gold/50 group-hover:text-gold transition-colors flex-shrink-0 mt-1" />
              </div>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {flags.length > 0 ? (
              flags.map(flag => (
                <div key={flag.id} className="aged-card rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <Flag size={18} className="text-amber-light" />
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadges[flag.status]?.class || statusBadges.open.class}`}>
                        {statusBadges[flag.status]?.label || 'Open'}
                      </span>
                      {flag.bloodline && <span className="text-xs text-parchment/40">{flag.bloodline}</span>}
                    </div>
                    <span className="text-xs text-parchment/40">{flag.created_date ? new Date(flag.created_date).toLocaleString('en-AU') : ''}</span>
                  </div>
                  <p className="text-sm text-parchment/70 mb-3">{flag.dispute_description}</p>
                  {flag.content_item_id && (
                    <Link to={`/content/${flag.content_item_id}`} className="text-xs text-amber-light hover:text-gold">View content item →</Link>
                  )}
                  {flag.status === 'open' && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => resolveFlag(flag.id, 'resolved')} className="px-3 py-1.5 rounded-lg bg-green-900/20 text-green-400 text-xs border border-green-800/30 hover:bg-green-900/30 transition-colors flex items-center gap-1">
                        <CheckCircle size={14} /> Resolve
                      </button>
                      <button onClick={() => resolveFlag(flag.id, 'dismissed')} className="px-3 py-1.5 rounded-lg bg-[rgba(245,236,215,0.05)] text-parchment/50 text-xs border border-[rgba(245,236,215,0.1)] hover:bg-[rgba(245,236,215,0.08)] transition-colors flex items-center gap-1">
                        <XCircle size={14} /> Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="aged-card rounded-xl p-12 text-center">
                <Flag size={32} className="text-gold/30 mx-auto mb-3" />
                <p className="text-parchment/50">No open conflict flags.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}