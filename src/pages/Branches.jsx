import React, { useState, useEffect } from 'react';
import { GitBranch, Plus, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import AncestorAvatar from '@/components/AncestorAvatar';

const branchColors = ['#C9913A', '#E8C97A', '#8B6914', '#D4A04C', '#B8860B', '#CD853F'];

export default function Branches() {
  const [branches, setBranches] = useState([]);
  const [ancestors, setAncestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', ancestor_id: '', description: '' });

  useEffect(() => {
    Promise.all([
      base44.entities.Branch.list('-created_date'),
      base44.entities.Ancestor.list(),
    ]).then(([brs, ancs]) => {
      setBranches(brs || []);
      setAncestors(ancs || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.ancestor_id) return;
    try {
      const color = branchColors[branches.length % branchColors.length];
      const newBranch = await base44.entities.Branch.create({
        ...form,
        accent_color: color,
      });
      setBranches([newBranch, ...branches]);
      setForm({ name: '', ancestor_id: '', description: '' });
      setShowForm(false);
    } catch (e) {}
  };

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-12 max-w-5xl mx-auto">
        <div className="mb-10">
          <h1 className="font-display text-4xl md:text-5xl text-parchment mb-3">Family Branches</h1>
          <p className="text-parchment/50 max-w-2xl">Each branch is a connected family line within the Freddi tree. Start your own to preserve your line's unique stories alongside the shared archive.</p>
        </div>

        <div className="aged-card rounded-2xl p-8 mb-8 text-center bg-gradient-to-br from-[#1A1614] to-[#0D0B0A]">
          <Sparkles size={32} className="text-gold mx-auto mb-4" />
          <h2 className="font-display text-2xl text-parchment mb-2">Start Your Branch</h2>
          <p className="text-parchment/50 text-sm mb-6 max-w-md mx-auto">Create a connected family line that shares the Freddi archive while adding its own unique stories and content.</p>
          <button onClick={() => setShowForm(!showForm)} className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal font-semibold hover:opacity-90 transition-opacity gold-glow">
            Begin Your Branch
          </button>
        </div>

        {showForm && (
          <div className="aged-card rounded-2xl p-6 mb-8">
            <h3 className="font-display text-xl text-parchment mb-4">New Branch Details</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-parchment/60 mb-1 block">Branch Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]"
                  placeholder="e.g. The Carlton Freddis" />
              </div>
              <div>
                <label className="text-sm text-parchment/60 mb-1 block">Your Ancestor in the Tree</label>
                <select value={form.ancestor_id} onChange={e => setForm({...form, ancestor_id: e.target.value})}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]">
                  <option value="">Select your ancestor...</option>
                  {ancestors.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-parchment/60 mb-1 block">Description (optional)</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2}
                  className="w-full bg-[#0D0B0A] border border-[rgba(201,145,58,0.2)] rounded-lg px-4 py-2.5 text-parchment focus:outline-none focus:border-[#C9913A]"
                  placeholder="Brief description of this branch..." />
              </div>
              <button onClick={handleCreate} className="px-6 py-2.5 rounded-lg bg-[#C9913A] text-charcoal font-semibold hover:opacity-90 transition-opacity">
                Create Branch
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1,2].map(i => <div key={i} className="aged-card rounded-xl h-40 animate-pulse" />)}
          </div>
        ) : branches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {branches.map(branch => {
              const ancestor = ancestors.find(a => a.id === branch.ancestor_id);
              return (
                <div key={branch.id} className="aged-card rounded-xl p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${branch.accent_color || '#C9913A'}20`, border: `2px solid ${branch.accent_color || '#C9913A'}` }}>
                    <GitBranch size={20} style={{ color: branch.accent_color || '#C9913A' }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-lg text-parchment">{branch.name}</h3>
                    {ancestor && <p className="text-sm text-amber-light/70">Rooted in: {ancestor.full_name}</p>}
                    {branch.description && <p className="text-xs text-parchment/50 mt-1">{branch.description}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="aged-card rounded-xl p-8 text-center">
            <p className="text-parchment/50">No branches yet. Be the first to start one.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}