import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Trash2, CheckCircle, AlertCircle, Sparkles, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dataURLtoBlob } from '../googleApi';

interface AttendanceFormProps {
  onSubmit: (formData: {
    nama: string;
    tanggal: string;
    keterangan: 'Hadir' | 'Izin' | 'Sakit' | 'Alpa';
    catatan: string;
    photoBlob: Blob | null;
    photoName: string | null;
  }) => Promise<void>;
  isSubmitting: boolean;
}

export default function AttendanceForm({ onSubmit, isSubmitting }: AttendanceFormProps) {
  const [nama, setNama] = useState('');
  // Set default to local date YYYY-MM-DD
  const [tanggal, setTanggal] = useState(() => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
    return localToday.toISOString().split('T')[0];
  });
  const [keterangan, setKeterangan] = useState<'Hadir' | 'Izin' | 'Sakit' | 'Alpa'>('Hadir');
  const [catatan, setCatatan] = useState('');
  
  // Media states
  const [uploadTab, setUploadTab] = useState<'camera' | 'file'>('camera');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);
    setPhotoPreview(null);
    setSelectedFile(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.error('Error playing video:', e));
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('Tidak dapat mengakses kamera. Pastikan Anda telah memberikan izin kamera.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setPhotoPreview(dataUrl);
        setSelectedFile(null);
        stopCamera();
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      stopCamera();
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearPhoto = () => {
    setPhotoPreview(null);
    setSelectedFile(null);
    stopCamera();
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) {
      alert('Silakan masukkan nama anggota.');
      return;
    }

    let photoBlob: Blob | null = null;
    let photoName: string | null = null;

    if (photoPreview) {
      if (selectedFile) {
        photoBlob = selectedFile;
        photoName = `absen_${nama.replace(/\s+/g, '_')}_${Date.now()}_${selectedFile.name}`;
      } else {
        // From camera base64 capture
        photoBlob = dataURLtoBlob(photoPreview);
        photoName = `absen_${nama.replace(/\s+/g, '_')}_${Date.now()}.jpg`;
      }
    }

    try {
      await onSubmit({
        nama,
        tanggal,
        keterangan,
        catatan,
        photoBlob,
        photoName,
      });

      // Reset form upon success
      setNama('');
      setCatatan('');
      setPhotoPreview(null);
      setSelectedFile(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-white border-2 border-teal-100 rounded-[32px] p-8 shadow-xl">
      <div className="flex items-center gap-2.5 mb-6">
        <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
          <Sparkles className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-black text-teal-950 uppercase tracking-wide">Form Absensi Anggota</h2>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-6">
        {/* Nama Anggota */}
        <div>
          <label htmlFor="nama_anggota" className="block text-xs font-black text-teal-900 uppercase tracking-widest mb-2">
            Nama Anggota <span className="text-orange-500">*</span>
          </label>
          <input
            id="nama_anggota"
            type="text"
            required
            placeholder="Masukkan nama lengkap anggota..."
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 font-bold text-slate-700 focus:border-teal-400 focus:bg-white outline-none transition-all text-sm"
          />
        </div>

        {/* Tanggal & Keterangan Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="tanggal_absen" className="block text-xs font-black text-teal-900 uppercase tracking-widest mb-2">
              Tanggal Absen <span className="text-orange-500">*</span>
            </label>
            <input
              id="tanggal_absen"
              type="date"
              required
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 font-medium text-slate-700 focus:border-teal-400 focus:bg-white outline-none transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-teal-900 uppercase tracking-widest mb-2">
              Keterangan Hadir <span className="text-orange-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as const).map((status) => {
                const isSelected = keterangan === status;
                let classNames = "px-3 py-2.5 text-xs font-bold rounded-xl border-2 text-center transition-all cursor-pointer ";
                
                if (isSelected) {
                  if (status === 'Hadir') classNames += 'border-teal-500 bg-teal-50 text-teal-700 shadow-sm';
                  else if (status === 'Izin') classNames += 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm';
                  else if (status === 'Sakit') classNames += 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm';
                  else classNames += 'border-rose-500 bg-rose-50 text-rose-700 shadow-sm';
                } else {
                  classNames += 'border-slate-200 bg-white text-slate-400 hover:border-slate-300';
                }

                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setKeterangan(status)}
                    className={classNames}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Catatan Tambahan */}
        <div>
          <label htmlFor="catatan_tambahan" className="block text-xs font-black text-teal-900 uppercase tracking-widest mb-2">
            Catatan Tambahan
          </label>
          <textarea
            id="catatan_tambahan"
            rows={2}
            placeholder="Tulis alasan jika izin/sakit, atau catatan kehadiran lainnya..."
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 text-sm focus:border-teal-400 focus:bg-white outline-none resize-none transition-all"
          />
        </div>

        {/* Bukti Foto / Media Input */}
        <div>
          <label className="block text-xs font-black text-teal-900 uppercase tracking-widest mb-2">
            Unggah Foto Bukti Kehadiran
          </label>

          {/* Tab Selector */}
          {!photoPreview && !isCameraActive && (
            <div className="flex border-2 border-teal-100 rounded-2xl p-1 bg-teal-50/50 mb-3.5">
              <button
                type="button"
                onClick={() => setUploadTab('camera')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  uploadTab === 'camera'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-teal-700 hover:text-teal-900'
                }`}
              >
                <Camera className="h-4 w-4" /> Ambil Kamera
              </button>
              <button
                type="button"
                onClick={() => setUploadTab('file')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  uploadTab === 'file'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-teal-700 hover:text-teal-900'
                }`}
              >
                <Upload className="h-4 w-4" /> Unggah File
              </button>
            </div>
          )}

          {/* Preview State */}
          {photoPreview ? (
            <div className="relative border-4 border-white shadow-2xl rounded-3xl overflow-hidden bg-slate-50 max-h-[280px]">
              <img
                src={photoPreview}
                alt="Pratinjau bukti absensi"
                className="w-full h-full object-contain max-h-[280px]"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/70 to-transparent p-4 flex justify-between items-center">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-teal-400" /> Foto Terpilih
                </span>
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-all shadow"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : isCameraActive ? (
            /* Active Camera Interface */
            <div className="relative border-4 border-white shadow-2xl rounded-3xl overflow-hidden bg-slate-900 aspect-video flex flex-col justify-between">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 to-transparent p-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="px-5 py-2.5 bg-[#FDE047] hover:bg-[#ebce31] text-teal-950 text-xs font-black rounded-xl shadow-lg hover:scale-105 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="h-4 w-4" /> Ambil Foto
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2.5 bg-slate-700/80 hover:bg-slate-700 text-white text-xs font-bold rounded-xl shadow transition-all cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          ) : (
            /* Standby State */
            <div className="border-2 border-dashed border-teal-200 rounded-2xl p-6 text-center hover:border-teal-400 transition-all bg-white">
              {uploadTab === 'camera' ? (
                <div>
                  <Camera className="mx-auto h-8 w-8 text-teal-600 mb-2" />
                  <p className="text-xs font-bold text-teal-900 mb-1">Ambil Foto Langsung via Kamera</p>
                  <p className="text-[11px] text-teal-600/70 mb-4">Memerlukan akses kamera perangkat Anda</p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-4 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-black border-2 border-teal-200 rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="h-3.5 w-3.5" /> Aktifkan Kamera
                  </button>
                </div>
              ) : (
                <div>
                  <Upload className="mx-auto h-8 w-8 text-teal-600 mb-2" />
                  <p className="text-xs font-bold text-teal-900 mb-1">Pilih File Foto dari Perangkat</p>
                  <p className="text-[11px] text-teal-600/70 mb-4">Mendukung file gambar (JPG, PNG)</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-black border-2 border-teal-200 rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ImageIcon className="h-3.5 w-3.5" /> Pilih File Gambar
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              )}

              {cameraError && (
                <div className="mt-3 p-2 bg-rose-50 text-rose-600 text-[11px] rounded-lg flex items-center justify-center gap-1 border border-rose-100">
                  <AlertCircle className="h-3.5 w-3.5" /> {cameraError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || isCameraActive}
          className="w-full py-4.5 bg-[#FB923C] hover:bg-[#f97316] disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-sm rounded-[20px] transition-all shadow-lg shadow-orange-100 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Memproses Kehadiran...
            </>
          ) : (
            <>
              KIRIM DATA ABSEN
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
