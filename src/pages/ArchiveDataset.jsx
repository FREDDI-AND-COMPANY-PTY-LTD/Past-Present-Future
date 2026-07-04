import React, { useState, useEffect, useMemo } from 'react';
import { Table, Search, Download, Cloud, Loader2, Check, ChevronDown, ChevronUp, Database } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import DataOwnershipPanel from '@/components/DataOwnershipPanel';

const SECTIONS = [
  { key: 'ancestors', label: 'Ancestors' },
  { key: 'content_items', label: 'Content Items' },
  { key: 'sources', label: 'Sources' },
  { key: 'comments', label: 'Comments' },
  { key: 'conflict_flags', label: 'Conflict Flags' },
  { key: 'branches', label: 'Branches' },
  { key: 'migration', label: 'Migration Waypoints' },
  { key: 'activity', label: 'Activity Log' },
];

export default function ArchiveDataset() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('ancestors');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [backingUp, setBackingUp] = useState(false);
  const [backupResult, setBackupResult] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('exportArchiveDataset', {});
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to load dataset');
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const currentRows = useMemo(() => {
    if (!data?.dataset?.[activeSection]) return [];
    let rows = data.dataset[activeSection];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => JSON.stringify(r).toLowerCase().includes(q));
    }
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = (a[sortKey] ?? '').toString().toLowerCase();
        const bv = (b[sortKey] ?? '').toString().toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return rows;
  }, [data, activeSection, search, sortKey, sortDir]);

  const headers = currentRows.length > 0 ? Object.keys(currentRows[0]) : [];

  const handleSort = (h) => {
    if (sortKey === h) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(h);
      setSortDir('asc');
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await base44.functions.invoke('exportArchiveDataset', { download: true });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data?.file_name || 'Freddi_Archive_Dataset.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError('Download failed: ' + (e.message || ''));
    }
    setDownloading(false);
  };

  const handleBackup = async () => {
    setBackingUp(true);
    setBackupResult(null);
    try {
      const res = await base44.functions.invoke('exportArchiveDataset', { backup_to_drive: true });
      setBackupResult(res.data?.backup_result);
    } catch (e) {
      setBackupResult({ status: 'error', details: e.message || 'Backup failed' });
    }
    setBackingUp(false);
  };

  return (
    <Layout>
      <div className="px-6 lg:px-12 py-12 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <h1 className="font-display text-4xl text-parchment mb-2 flex items-center gap-3">
              <Database size={32} className="text-gold" /> Family Archive Dataset
            </h1>
            <p className="text-parchment/50 text-sm">A searchable collation of every data point entered into the archive.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              disabled={downloading || !data}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[rgba(201,145,58,0.3)] text-amber-light text-sm hover:bg-[rgba(201,145,58,0.08)] transition-colors disabled:opacity-50"
            >
              {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Download CSV
            </button>
            <button
              onClick={handleBackup}
              disabled={backingUp || !data}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#C9913A] to-[#E8C97A] text-charcoal font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 gold-glow"
            >
              {backingUp ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />}
              Backup to Drive
            </button>
          </div>
        </div>

        <DataOwnershipPanel />

        {backupResult && (
          <div className={`aged-card rounded-xl p-4 mb-6 flex items-center gap-3 ${backupResult.status === 'success' ? 'border-[rgba(201,145,58,0.4)]' : 'border-red-500/30'}`}>
            {backupResult.status === 'success' ? (
              <>
                <Check size={20} className="text-gold" />
                <div>
                  <p className="text-sm text-parchment">Dataset backed up to Google Drive.</p>
                  <p className="text-xs text-parchment/40">File ID: {backupResult.drive_file_id}</p>
                </div>
              </>
            ) : (
              <p className="text-sm text-red-400">Backup failed: {JSON.stringify(backupResult.details)}</p>
            )}
          </div>
        )}

        {loading ? (
          <div className="aged-card rounded-xl h-96 animate-pulse" />
        ) : error ? (
          <div className="aged-card rounded-xl p-8 text-center">
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <button onClick={fetchData} className="text-gold text-sm hover:text-amber-light">Try again</button>
          </div>
        ) : data ? (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
              {SECTIONS.map(sec => (
                <button
                  key={sec.key}
                  onClick={() => { setActiveSection(sec.key); setSearch(''); setSortKey(null); }}
                  className={`aged-card rounded-xl p-4 text-center transition-all ${activeSection === sec.key ? 'border-[rgba(201,145,58,0.4)] bg-[rgba(201,145,58,0.06)]' : 'hover:border-[rgba(201,145,58,0.25)]'}`}
                >
                  <p className="font-display text-2xl text-gold">{data.counts?.[sec.key] ?? 0}</p>
                  <p className="text-xs text-parchment/50 mt-1">{sec.label}</p>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="aged-card rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <Search size={18} className="text-gold/60" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={`Search within ${SECTIONS.find(s => s.key === activeSection)?.label}...`}
                  className="flex-1 bg-transparent text-parchment text-sm focus:outline-none placeholder:text-parchment/30"
                />
                <span className="text-xs text-parchment/40">{currentRows.length} record{currentRows.length !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Table */}
            {currentRows.length > 0 ? (
              <div className="aged-card rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[rgba(201,145,58,0.15)] bg-[rgba(201,145,58,0.04)]">
                        {headers.map(h => (
                          <th
                            key={h}
                            onClick={() => handleSort(h)}
                            className="px-4 py-3 text-left text-xs uppercase tracking-wider text-amber-light/70 cursor-pointer hover:text-gold whitespace-nowrap select-none"
                          >
                            <span className="flex items-center gap-1">
                              {h.replace(/_/g, ' ')}
                              {sortKey === h && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentRows.map((row, idx) => (
                        <tr key={idx} className="border-b border-[rgba(201,145,58,0.06)] hover:bg-[rgba(201,145,58,0.03)] transition-colors">
                          {headers.map(h => (
                            <td key={h} className="px-4 py-3 text-parchment/70 whitespace-nowrap max-w-xs truncate" title={String(row[h] ?? '')}>
                              {String(row[h] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="aged-card rounded-xl p-12 text-center">
                <p className="text-parchment/50 text-sm">No records found{search ? ' matching your search' : ' in this section'}.</p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </Layout>
  );
}