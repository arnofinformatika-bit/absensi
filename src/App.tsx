import React, { useState, useEffect } from 'react';
import { LogOut, CheckCircle2, AlertCircle, Sparkles, User, Database, PlusCircle, Layout, Lock, FolderOpen, ExternalLink, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Component imports
import AttendanceForm from './components/AttendanceForm';
import AttendanceList from './components/AttendanceList';

// Core imports
import { initAuth, googleSignIn, logout, setAccessToken, getAccessToken } from './firebase';
import { findOrCreateSpreadsheet, findOrCreateFolder, uploadPhotoToDrive, addAttendanceRecord, fetchAttendanceRecords } from './googleApi';
import { AttendanceRecord, SheetConfig, AppUser } from './types';

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Login form states
  const [loginNama, setLoginNama] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Spreadsheet / Drive states
  const [sheetConfig, setSheetConfig] = useState<SheetConfig>({
    spreadsheetId: null,
    spreadsheetUrl: null,
    folderId: null,
    status: 'loading',
  });

  // Attendance Records
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  // Notifications
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 6000); // 6 seconds auto-dismiss
  };

  // Auth initialization
  useEffect(() => {
    const savedUserStr = localStorage.getItem('local_user_session');
    const savedToken = localStorage.getItem('google_access_token');
    
    if (savedUserStr && savedToken) {
      try {
        const savedUser = JSON.parse(savedUserStr) as AppUser;
        setUser(savedUser);
        setNeedsAuth(false);
        setToken(savedToken);
        setAccessToken(savedToken);
        setupGoogleResources(savedToken, savedUser);
      } catch (err) {
        console.error('Error restoring session:', err);
        setNeedsAuth(true);
      }
    } else {
      setNeedsAuth(true);
      setSheetConfig({
        spreadsheetId: null,
        spreadsheetUrl: null,
        folderId: null,
        status: 'not_connected',
      });
    }
  }, []);

  // Handle resource checking and setup
  const setupGoogleResources = async (accessToken: string, currentUser: AppUser) => {
    setIsSyncing(true);
    setSheetConfig(prev => ({ ...prev, status: 'loading' }));
    try {
      // 1. Find or verify Google Spreadsheet ID
      const { spreadsheetId, webViewLink } = await findOrCreateSpreadsheet(accessToken);
      
      // 2. Find or create Google Drive Folder "Bukti_Foto_Absensi"
      const folderId = await findOrCreateFolder(accessToken);

      setSheetConfig({
        spreadsheetId,
        spreadsheetUrl: webViewLink,
        folderId,
        status: 'configured',
      });

      // 3. Fetch initial attendance log from Google Sheets
      const googleLogs = await fetchAttendanceRecords(accessToken, spreadsheetId);
      setRecords(googleLogs);

    } catch (err: any) {
      console.error('Resource setup error:', err);
      showNotification('Gagal memuat atau menyinkronkan data Google Sheets.', 'error');
      setSheetConfig(prev => ({ ...prev, status: 'error' }));
    } finally {
      setIsSyncing(false);
    }
  };

  // Name & Password 1234 Login Handler with integrated Google Sync
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginNama.trim()) {
      showNotification('Silakan masukkan nama lengkap Anda.', 'error');
      return;
    }
    if (loginPassword !== '1234') {
      showNotification('Password salah! Gunakan password "1234".', 'error');
      return;
    }

    setIsLoggingIn(true);
    try {
      showNotification('Menghubungkan Akun Google untuk sinkronisasi otomatis...');
      const result = await googleSignIn();
      if (result) {
        const sessionUser: AppUser = {
          displayName: loginNama,
          email: result.user.email || 'anonim@email.com',
          photoURL: result.user.photoURL,
          isGoogleConnected: true,
        };

        localStorage.setItem('local_user_session', JSON.stringify(sessionUser));
        localStorage.setItem('google_access_token', result.accessToken);
        
        setUser(sessionUser);
        setToken(result.accessToken);
        setAccessToken(result.accessToken);
        setNeedsAuth(false);
        
        showNotification(`Selamat datang, ${loginNama}! Terhubung otomatis dengan Google Sheets.`);
        await setupGoogleResources(result.accessToken, sessionUser);
      } else {
        showNotification('Gagal menghubungkan Google. Silakan coba lagi.', 'error');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      showNotification('Gagal masuk. Pastikan Anda menyelesaikan login Google.', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Re-synchronize manual handler
  const handleReconnect = async () => {
    const currentToken = token || getAccessToken() || localStorage.getItem('google_access_token');
    if (!currentToken) {
      showNotification('Token akses Google tidak ditemukan. Silakan masuk kembali.', 'error');
      return;
    }
    if (user) {
      await setupGoogleResources(currentToken, user);
      showNotification('Sinkronisasi data absensi berhasil diselesaikan!');
    }
  };

  // Logout click handler
  const handleLogout = async () => {
    const confirmLogout = window.confirm('Apakah Anda yakin ingin keluar dari aplikasi?');
    if (!confirmLogout) return;

    try {
      if (user?.isGoogleConnected) {
        await logout();
      }
      localStorage.removeItem('local_user_session');
      localStorage.removeItem('google_access_token');
      setUser(null);
      setToken(null);
      setAccessToken(null);
      setNeedsAuth(true);
      setRecords([]);
      setSheetConfig({
        spreadsheetId: null,
        spreadsheetUrl: null,
        folderId: null,
        status: 'not_connected',
      });
      showNotification('Anda telah berhasil keluar dari aplikasi.');
    } catch (err: any) {
      console.error('Sign out error:', err);
      showNotification('Gagal keluar dari aplikasi.', 'error');
    }
  };

  // Handle Form submission
  const handleAttendanceSubmit = async (formData: {
    nama: string;
    tanggal: string;
    keterangan: 'Hadir' | 'Izin' | 'Sakit' | 'Alpa';
    catatan: string;
    photoBlob: Blob | null;
    photoName: string | null;
  }) => {
    setIsSubmitting(true);
    try {
      const uuid = typeof crypto.randomUUID === 'function' 
        ? crypto.randomUUID() 
        : 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

      let uploadedPhotoUrl = '';
      const currentToken = token || getAccessToken() || localStorage.getItem('google_access_token');

      if (currentToken && sheetConfig.spreadsheetId && sheetConfig.folderId) {
        // 1. Upload photo to Drive if included
        if (formData.photoBlob && formData.photoName) {
          showNotification('Sedang mengunggah foto bukti ke Google Drive...');
          const uploadResult = await uploadPhotoToDrive(
            currentToken,
            sheetConfig.folderId,
            formData.photoName,
            formData.photoBlob
          );
          uploadedPhotoUrl = uploadResult.webViewLink;
        }

        // 2. Prepare new record
        const newRecord: AttendanceRecord = {
          id: uuid,
          tanggal: formData.tanggal,
          nama: formData.nama,
          keterangan: formData.keterangan,
          catatan: formData.catatan,
          fotoBuktiUrl: uploadedPhotoUrl,
          waktuAbsen: new Date().toISOString(),
          emailPenginput: user?.email || 'anonim@email.com',
        };

        // 3. Write record row to Google Sheets
        showNotification('Sedang menyimpan absensi ke Google Sheets...');
        await addAttendanceRecord(currentToken, sheetConfig.spreadsheetId, newRecord);

        // 4. Update state
        setRecords(prev => [newRecord, ...prev]);
        showNotification(`Absensi untuk ${formData.nama} berhasil disimpan ke Spreadsheet!`);
      } else {
        showNotification('Tidak terhubung dengan Google Sheets. Silakan login kembali.', 'error');
      }

    } catch (err: any) {
      console.error('Submit attendance error:', err);
      showNotification('Gagal menyimpan absensi. Silakan coba lagi.', 'error');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0FDFA] text-slate-800 font-sans flex flex-col selection:bg-teal-100">
      
      {/* Dynamic Alert Banner / Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 inset-x-4 z-50 flex justify-center pointer-events-none"
          >
            <div className={`pointer-events-auto flex items-center gap-2.5 px-4.5 py-3.5 rounded-xl shadow-xl border-2 text-xs font-bold max-w-md ${
              notification.type === 'success'
                ? 'bg-teal-50 border-teal-200 text-teal-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {notification.type === 'success' ? (
                <CheckCircle2 className="h-4.5 w-4.5 text-teal-600 shrink-0" />
              ) : (
                <AlertCircle className="h-4.5 w-4.5 text-rose-500 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {needsAuth ? (
        /* Sign-In Splash Interface */
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-white border-2 border-teal-100 rounded-[32px] p-8 shadow-2xl text-center relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-2 bg-teal-500" />
            
            <div className="mx-auto w-12 h-12 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mb-4">
              <Database className="h-6 w-6" />
            </div>

            <h1 className="text-2xl font-black text-teal-950 uppercase tracking-wide mb-1">Absensi Anggota</h1>
            <p className="text-xs text-teal-800/80 font-bold max-w-[320px] mx-auto mb-6">
              Sistem pencatatan absensi yang terintegrasi otomatis dengan akun Google Sheets & Google Drive Anda sendiri.
            </p>

            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-black text-teal-900 uppercase tracking-widest mb-1.5">
                  Nama Anggota
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masukkan nama lengkap Anda..."
                  value={loginNama}
                  onChange={(e) => setLoginNama(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold text-slate-700 placeholder-slate-400 focus:border-teal-400 focus:bg-white outline-none transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-teal-900 uppercase tracking-widest mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Masukkan password..."
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold text-slate-700 placeholder-slate-400 focus:border-teal-400 focus:bg-white outline-none transition-all text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full mt-2 py-4 bg-[#FB923C] hover:bg-[#f97316] text-white font-black text-sm rounded-2xl transition-all shadow-lg shadow-orange-100 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoggingIn ? 'MEMPROSES...' : 'MASUK SEKARANG'}
              </button>
            </form>

            <div className="flex items-center justify-center gap-1.5 mt-5 text-[10px] text-teal-600 font-bold uppercase tracking-wider">
              <Lock className="h-3.5 w-3.5 text-teal-600" /> Password bawaan: 1234
            </div>
          </motion.div>
        </div>
      ) : (
        /* Main Application Workspace */
        <>
          {/* Top Navigation Bar */}
          <header className="bg-white border-b-2 border-teal-100 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
              {/* Brand Logo */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="p-2.5 bg-teal-600 text-white rounded-xl shadow-md">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-sm font-black text-teal-950 uppercase tracking-wide leading-tight">Absensi Anggota</h1>
                  <span className="text-[9px] text-teal-600 font-black tracking-widest uppercase">Google Sync Engine</span>
                </div>
              </div>

              {/* Quick Links for Spreadsheet & Folder */}
              {sheetConfig.status === 'configured' && (
                <div className="flex items-center gap-2">
                  <a
                    href={sheetConfig.spreadsheetUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] sm:text-xs font-black rounded-xl border-2 border-emerald-100 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                    title="Buka Google Sheets"
                  >
                    <Database className="h-4 w-4 text-emerald-600" />
                    <span className="hidden sm:inline">Buka Spreadsheet</span>
                    <span className="sm:hidden">Sheet</span>
                    <ExternalLink className="h-3 w-3 text-emerald-500" />
                  </a>
                  {sheetConfig.folderId && (
                    <a
                      href={`https://drive.google.com/drive/folders/${sheetConfig.folderId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-orange-50 hover:bg-orange-100 text-orange-800 text-[10px] sm:text-xs font-black rounded-xl border-2 border-orange-100 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                      title="Buka Folder Drive"
                    >
                      <FolderOpen className="h-4 w-4 text-orange-500" />
                      <span className="hidden sm:inline">Folder Foto</span>
                      <span className="sm:hidden">Drive</span>
                      <ExternalLink className="h-3 w-3 text-orange-400" />
                    </a>
                  )}
                </div>
              )}

              {/* User Profile & Logout */}
              {user && (
                <div className="flex items-center gap-3 bg-teal-50/40 border-2 border-teal-100/60 rounded-2xl p-1.5 pr-3 shrink-0 ml-auto sm:ml-0">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User Profile'}
                      className="h-8 w-8 rounded-xl object-cover border border-slate-200"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
                      <User className="h-4.5 w-4.5" />
                    </div>
                  )}
                  <div className="hidden md:block text-left">
                    <span className="text-xs font-black text-teal-950 block truncate max-w-[100px]">{user.displayName}</span>
                    <span className="text-[9px] text-teal-600 font-bold block truncate max-w-[100px]">{user.email}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    title="Keluar"
                    className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* Main Dashboard Space */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            
            {/* Form and List Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Input Form (Takes 5 spans on desktop) */}
              <div className="lg:col-span-5 space-y-6">
                <AttendanceForm
                  onSubmit={handleAttendanceSubmit}
                  isSubmitting={isSubmitting}
                />
              </div>

              {/* Right Column: Attendance Records (Takes 7 spans on desktop) */}
              <div className="lg:col-span-7 h-full">
                <AttendanceList
                  records={records}
                  isLoading={isSyncing}
                />
              </div>

            </div>
          </main>

          {/* Footer Bar */}
          <footer className="border-t-2 border-teal-100 bg-white py-5 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-[10px] text-teal-800 font-black uppercase tracking-wider">
              Absensi Anggota &bull; Terintegrasi Google Drive &amp; Sheets API &bull; {new Date().getFullYear()}
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
