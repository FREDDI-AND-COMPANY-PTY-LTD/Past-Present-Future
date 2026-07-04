import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ZoomIn, ZoomOut, ChevronRight, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';

export default function FamilyTree() {
  const [ancestors, setAncestors] = useState([]);
  const [contentItems, setContentItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAncestor, setSelectedAncestor] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    Promise.all([
      base44.entities.Ancestor.list(),
      base44.entities.ContentItem.filter({}),
    ]).then(([ancs, items]) => {
      setAncestors(ancs || []);
      setContentItems(items || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Build tree structure
  const buildTree = useCallback(() => {
    const nodes = new Map();
    ancestors.forEach(a => nodes.set(a.id, { ...a, children: [], level: 0 }));

    // Link children to parents
    ancestors.forEach(a => {
      if (a.mother_id && nodes.has(a.mother_id)) {
        nodes.get(a.mother_id).children.push(a.id);
      }
      if (a.father_id && nodes.has(a.father_id)) {
        const f = nodes.get(a.father_id);
        if (!f.children.includes(a.id)) f.children.push(a.id);
      }
    });

    // Find roots (no parents in system)
    const roots = ancestors.filter(a => {
      const hasMother = a.mother_id && nodes.has(a.mother_id);
      const hasFather = a.father_id && nodes.has(a.father_id);
      return !hasMother && !hasFather;
    });

    // Assign levels and positions
    const positions = new Map();
    let yCounter = 0;

    const assignPositions = (ancestorId, level) => {
      const node = nodes.get(ancestorId);
      if (!node) return;
      node.level = level;

      if (node.children.length === 0) {
        positions.set(ancestorId, { level, y: yCounter });
        yCounter++;
      } else {
        const childYs = [];
        node.children.forEach(cid => {
          assignPositions(cid, level + 1);
          const pos = positions.get(cid);
          if (pos) childYs.push(pos.y);
        });
        const avgY = childYs.length > 0 ? childYs.reduce((a, b) => a + b, 0) / childYs.length : yCounter;
        positions.set(ancestorId, { level, y: avgY });
      }
    };

    roots.forEach(r => assignPositions(r.id, 0));

    return { nodes, positions, roots };
  }, [ancestors]);

  const { nodes, positions, roots } = loading ? { nodes: new Map(), positions: new Map(), roots: [] } : buildTree();

  const nodeWidth = 180;
  const nodeHeight = 100;
  const levelGap = 280;
  const yGap = 140;

  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };
  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    }
  };
  const handleMouseUp = () => setIsDragging(false);

  const selectedContent = selectedAncestor
    ? contentItems.filter(c => c.ancestor_ids?.includes(selectedAncestor.id))
    : [];

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-4xl text-parchment mb-2">Family Tree</h1>
            <p className="text-parchment/50 text-sm">Click any ancestor to explore their stories. Drag to pan, use buttons to zoom.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setZoom(z => Math.max(0.3, z - 0.2))} className="w-10 h-10 rounded-lg aged-card flex items-center justify-center text-gold hover:border-[rgba(201,145,58,0.4)]">
              <ZoomOut size={18} />
            </button>
            <button onClick={() => setZoom(z => Math.min(2.5, z + 0.2))} className="w-10 h-10 rounded-lg aged-card flex items-center justify-center text-gold hover:border-[rgba(201,145,58,0.4)]">
              <ZoomIn size={18} />
            </button>
          </div>
        </div>
      </div>

      <div
        className="relative overflow-hidden bg-charcoal border-y border-[rgba(201,145,58,0.1)]"
        style={{ height: '70vh', cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-parchment/50">Building the family tree...</p>
          </div>
        ) : ancestors.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-parchment/50">No ancestors in the tree yet.</p>
          </div>
        ) : (
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              position: 'absolute',
              width: '100%',
              height: '100%',
            }}
          >
            <svg width="100%" height="100%" style={{ minWidth: '1000px', minHeight: '600px' }}>
              {/* Connection lines */}
              {ancestors.map(a => {
                const pos = positions.get(a.id);
                if (!pos) return null;
                const x = pos.level * levelGap + 100;
                const y = pos.y * yGap + 50;
                const lines = [];
                [a.mother_id, a.father_id].forEach(pid => {
                  if (pid && positions.has(pid)) {
                    const ppos = positions.get(pid);
                    const px = ppos.level * levelGap + 100;
                    const py = ppos.y * yGap + 50;
                    lines.push(
                      <path
                        key={`${pid}-${a.id}`}
                        d={`M ${px + 90} ${py + 40} C ${px + 90} ${py + 80}, ${x} ${py + 80}, ${x} ${y}`}
                        stroke="#C9913A"
                        strokeWidth="2"
                        fill="none"
                        opacity="0.4"
                      />
                    );
                  }
                });
                return lines;
              })}

              {/* Nodes */}
              {ancestors.map(a => {
                const pos = positions.get(a.id);
                if (!pos) return null;
                const x = pos.level * levelGap + 10;
                const y = pos.y * yGap;
                return (
                  <foreignObject key={a.id} x={x} y={y} width={nodeWidth} height={nodeHeight}>
                    <div
                      onClick={() => setSelectedAncestor(a)}
                      style={{
                        width: '100%', height: '100%', cursor: 'pointer',
                        background: '#1A1614', borderRadius: '12px',
                        border: `2px solid ${a.living ? '#E8C97A' : 'rgba(201,145,58,0.4)'}`,
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px',
                        boxShadow: a.living ? '0 0 15px rgba(201,145,58,0.15)' : 'none',
                      }}
                    >
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(201,145,58,0.3)', flexShrink: 0, background: '#0D0B0A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {a.profile_photo ? (
                          <img src={a.profile_photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: a.living ? 'none' : 'sepia(0.3) brightness(0.85)' }} />
                        ) : (
                          <span style={{ fontFamily: "'Playfair Display', serif", color: 'rgba(201,145,58,0.6)', fontSize: '18px' }}>{a.full_name?.charAt(0)}</span>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: "'Playfair Display', serif", color: '#F5ECD7', fontSize: '13px', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.full_name}</p>
                        <p style={{ color: 'rgba(245,236,215,0.4)', fontSize: '10px', margin: 0 }}>
                          {a.birth_date ? new Date(a.birth_date).getFullYear() : ''}
                          {a.death_date ? ` – ${new Date(a.death_date).getFullYear()}` : a.living ? ' – present' : ''}
                        </p>
                      </div>
                    </div>
                  </foreignObject>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Side panel */}
      {selectedAncestor && (
        <div className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-[#1A1614] border-l border-[rgba(201,145,58,0.2)] z-50 overflow-y-auto animate-fade-in">
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="font-display text-2xl text-parchment">{selectedAncestor.full_name}</h2>
              <button onClick={() => setSelectedAncestor(null)} className="text-parchment/40 hover:text-parchment"><X size={20} /></button>
            </div>
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#C9913A] bg-[#0D0B0A] flex items-center justify-center">
                {selectedAncestor.profile_photo ? (
                  <img src={selectedAncestor.profile_photo} alt="" className={`w-full h-full object-cover ${!selectedAncestor.living ? 'sepia-tint' : ''}`} />
                ) : (
                  <span className="font-display text-gold/60 text-3xl">{selectedAncestor.full_name?.charAt(0)}</span>
                )}
              </div>
            </div>
            <div className="space-y-2 text-sm mb-6">
              {selectedAncestor.birth_date && <p className="text-parchment/60">Born: {new Date(selectedAncestor.birth_date).toLocaleDateString('en-AU')}</p>}
              {selectedAncestor.death_date && <p className="text-parchment/60">Died: {new Date(selectedAncestor.death_date).toLocaleDateString('en-AU')}</p>}
              {selectedAncestor.birth_place && <p className="text-parchment/60">{selectedAncestor.birth_place}</p>}
              {selectedAncestor.nationality && <p className="text-parchment/60">{selectedAncestor.nationality}</p>}
            </div>
            {selectedAncestor.biography && <p className="text-parchment/50 text-sm leading-relaxed mb-6">{selectedAncestor.biography}</p>}

            <Link to={`/ancestor/${selectedAncestor.id}`} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#C9913A] text-charcoal text-sm font-semibold hover:opacity-90 transition-opacity mb-6">
              View Full Profile <ChevronRight size={16} />
            </Link>

            <div>
              <h3 className="font-display text-lg text-parchment mb-3">Content ({selectedContent.length})</h3>
              {selectedContent.length > 0 ? (
                <div className="space-y-2">
                  {selectedContent.map(c => (
                    <Link key={c.id} to={`/content/${c.id}`} className="block aged-card rounded-lg p-3 hover:border-[rgba(201,145,58,0.4)] transition-colors">
                      <p className="text-sm text-parchment">{c.title}</p>
                      <p className="text-xs text-parchment/40">{c.date ? new Date(c.date).toLocaleDateString('en-AU') : 'No date'}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-parchment/40 text-sm">No content tagged yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}