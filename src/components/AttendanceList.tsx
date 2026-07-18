import React, { useState } from 'react';
import { Search, Calendar, CheckSquare, AlertCircle, Eye, EyeOff, FileText, Clock, ExternalLink, X, HelpCircle, ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AttendanceRecord } from '../types';

interface AttendanceListProps {
  records: AttendanceRecord[];
  isLoading: boolean;
}

export default function AttendanceList({ records, isLoading }: AttendanceListProps) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('Semua');
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);

  // Filter records
  const filteredRecords = records.filter((rec) => {
    const nameSafe = rec.nama || '';
    const catatanSafe = rec.catatan || '';
    const matchesSearch = nameSafe.toLowerCase().includes(search.toLowerCase()) || 
                          catatanSafe.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'Semua' || rec.keterangan === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Badge stylings
  const getBadgeClass = (status: string) => {
    switch (status) {
      case 'Hadir':
        return 'bg-teal-50 text-teal-700 border-teal-100';
      case 'Izin':
        return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'Sakit':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'Alpa':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  // Convert Date from Google Sheets or standard timestamp to Indonesian readable time/date
  const formatDateTime = (dateStr: string) => {
    try {
      if (!dateStr) return '';
      // If it looks like ISO or similar
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr; // Fallback if simple date string is written
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatClock = (dateTimeStr: string) => {
    try {
      if (!dateTimeStr) return '';
      const d = new Date(dateTimeStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }) + ' WIB';
    } catch {
      return '';
    }
  };

  return (
    <div className="bg-white border-2 border-teal-100 rounded-[32px] p-8 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
            <CheckSquare className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-black text-teal-950 uppercase tracking-wide">Riwayat Absensi</h2>
        </div>
        <span className="text-xs font-black px-3 py-1 bg-teal-50 text-teal-800 border-2 border-teal-100 rounded-xl">
          {filteredRecords.length} Catatan
        </span>
      </div>

      {/* Search & Filters */}
      <div className="space-y-4 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama anggota atau catatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 placeholder-slate-400 focus:border-teal-400 focus:bg-white outline-none transition-all text-xs"
          />
        </div>

        {/* Status Pills */}
        <div className="flex flex-wrap gap-1.5">
          {['Semua', 'Hadir', 'Izin', 'Sakit', 'Alpa'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border-2 transition-all cursor-pointer ${
                filterStatus === status
                  ? 'bg-teal-600 border-teal-600 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* List Container */}
      <div className="flex-1 overflow-y-auto max-h-[500px] pr-1 -mr-2 space-y-4">
        {isLoading ? (
          /* Loading Skeleton */
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="p-4 border border-slate-50 rounded-xl animate-pulse flex justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-100 rounded w-1/3"></div>
                  <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                  <div className="h-3 bg-slate-100 rounded w-1/4"></div>
                </div>
                <div className="w-12 h-12 bg-slate-100 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : filteredRecords.length === 0 ? (
          /* Empty State */
          <div className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-700">Tidak Ada Catatan</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[240px] mx-auto">
              {search || filterStatus !== 'Semua'
                ? 'Tidak ada data absensi yang sesuai dengan kriteria pencarian Anda.'
                : 'Belum ada data absensi yang tersimpan di Google Sheets Anda.'}
            </p>
          </div>
        ) : (
          /* Records List */
          filteredRecords.map((rec) => (
            <div
              key={rec.id}
              className="p-4 bg-white border-2 border-slate-50 rounded-2xl hover:border-teal-100 hover:shadow-md transition-all flex justify-between items-start gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h3 className="text-sm font-black text-slate-800 truncate">{rec.nama}</h3>
                  <span className={`px-2 py-0.5 text-[10px] font-black rounded-md border-2 ${getBadgeClass(rec.keterangan)}`}>
                    {rec.keterangan}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 text-[11px] mb-2.5 font-medium">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-teal-600" /> {formatDateTime(rec.tanggal)}
                  </span>
                  {rec.waktuAbsen && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-teal-600" /> {formatClock(rec.waktuAbsen)}
                    </span>
                  )}
                </div>

                {rec.catatan && (
                  <p className="text-xs text-slate-600 bg-teal-50/20 rounded-xl p-3 border border-teal-50 italic line-clamp-2">
                    "{rec.catatan}"
                  </p>
                )}

                <p className="text-[10px] text-slate-400 mt-2 font-medium truncate">
                  Diinput oleh: {rec.emailPenginput}
                </p>
              </div>

              {/* Photo Proof */}
              {rec.fotoBuktiUrl ? (
                <div className="relative group shrink-0">
                  <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-slate-200 bg-slate-50 cursor-pointer relative">
                    <img
                      src={rec.fotoBuktiUrl}
                      alt={`Bukti ${rec.nama}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-all"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        // If it fails to render (e.g. permission or iframe/cors issues), replace with a visual placeholder
                        e.currentTarget.style.display = 'none';
                        const p = e.currentTarget.parentElement;
                        if (p) {
                          const iconEl = p.querySelector('.fallback-icon');
                          if (iconEl) iconEl.classList.remove('hidden');
                        }
                      }}
                    />
                    {/* Fallback Icon inside same div */}
                    <div className="fallback-icon hidden absolute inset-0 flex items-center justify-center bg-slate-100 text-teal-600">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                    {/* Hover Eye Overlay */}
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                      <Eye className="h-3.5 w-3.5 text-white" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-center mt-1">
                    <button
                      onClick={() => setZoomImage({ url: rec.fotoBuktiUrl, title: rec.nama })}
                      className="text-[10px] text-teal-700 hover:text-teal-900 flex items-center gap-0.5 font-bold cursor-pointer"
                    >
                      Lihat
                    </button>
                    <a
                      href={rec.fotoBuktiUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-slate-400 hover:text-slate-600"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="w-14 h-14 rounded-xl border-2 border-slate-100 bg-slate-50 flex flex-col items-center justify-center text-slate-300 shrink-0">
                  <EyeOff className="h-4 w-4 mb-0.5" />
                  <span className="text-[8px] font-bold text-slate-400">No Foto</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Lightbox / Zoom Photo Modal */}
      <AnimatePresence>
        {zoomImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setZoomImage(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-3xl overflow-hidden max-w-lg w-full shadow-2xl z-10 border-2 border-teal-100"
            >
              {/* Header */}
              <div className="p-5 border-b-2 border-dashed border-teal-100 flex items-center justify-between">
                <h3 className="text-sm font-black text-teal-950 uppercase tracking-wide">Bukti Foto Absensi: {zoomImage.title}</h3>
                <button
                  onClick={() => setZoomImage(null)}
                  className="p-1.5 hover:bg-teal-50 text-teal-700 rounded-xl transition-all cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Photo Area */}
              <div className="bg-slate-950 flex items-center justify-center max-h-[400px] aspect-video">
                <img
                  src={zoomImage.url}
                  alt={zoomImage.title}
                  className="max-h-[400px] object-contain w-full h-full"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    // Fail gracefully inside zoom too
                    e.currentTarget.style.display = 'none';
                    const p = e.currentTarget.parentElement;
                    if (p) {
                      const errEl = p.querySelector('.zoom-error');
                      if (errEl) errEl.classList.remove('hidden');
                    }
                  }}
                />
                <div className="zoom-error hidden p-6 text-center text-slate-400 flex flex-col items-center">
                  <ImageIcon className="h-10 w-10 text-slate-600 mb-2" />
                  <p className="text-xs font-semibold text-slate-300">Gagal Memuat Gambar Langsung</p>
                  <p className="text-[10px] text-slate-500 max-w-[280px] mt-1 mb-4">
                    Beberapa browser membatasi pratinjau gambar Drive langsung karena kebijakan cookie/sandbox.
                  </p>
                  <a
                    href={zoomImage.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                  >
                    Buka di Tab Baru <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              {/* Footer action */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <a
                  href={zoomImage.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-[#FB923C] hover:bg-[#f97316] text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow"
                >
                  Buka di Google Drive <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
