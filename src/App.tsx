import React, { useState, useEffect } from 'react';
import { LogOut, CheckCircle2, AlertCircle, Sparkles, User, Database, PlusCircle, Layout, Lock, FolderOpen, ExternalLink, RefreshCw, Settings, Clipboard, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Component imports
import AttendanceForm from './components/AttendanceForm';
import AttendanceList from './components/AttendanceList';

// Types
import { AttendanceRecord, AppUser } from './types';

// Helper: Convert Blob to Base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Login form states
  const [loginNama, setLoginNama] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Apps Script Web App URL state
  const [webAppUrl, setWebAppUrl] = useState(() => {
    return localStorage.getItem('apps_script_web_app_url') || '';
  });
  const [tempUrlInput, setTempUrlInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Attendance Records
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  // Notifications
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 6000);
  };

  // Google Apps Script source code template for copy-paste
  const appsScriptCode = `// KODE UNTUK EXTENSIONS > APPS SCRIPT DI GOOGLE SPREADSHEET ANDA
// Hubungkan spreadsheet Anda dengan aman tanpa Firebase / Google Sign-In

function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    }
    var rows = sheet.getDataRange().getValues();
    var records = [];
    
    var headers = rows[0] || [];
    var idxNama = headers.indexOf("NAMA");
    var idxStatus = headers.indexOf("STATUS");
    var idxKeterangan = headers.indexOf("KETERANGAN");
    var idxUploadBukti = headers.indexOf("UPLOAD BUKTI");
    var idxTanggal = headers.indexOf("TANGGAL");
    
    if (idxNama === -1) idxNama = 0;
    if (idxStatus === -1) idxStatus = 1;
    if (idxKeterangan === -1) idxKeterangan = 2;
    if (idxUploadBukti === -1) idxUploadBukti = 3;
    if (idxTanggal === -1) idxTanggal = 4;

    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      if (row[idxNama]) {
        records.push({
          id: "row_" + i,
          nama: String(row[idxNama]),
          keterangan: String(row[idxStatus] || "Hadir"),
          catatan: String(row[idxKeterangan] || ""),
          fotoBuktiUrl: String(row[idxUploadBukti] || ""),
          tanggal: String(row[idxTanggal] || "")
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", data: records }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Sheet1");
    if (!sheet) {
      sheet = ss.getSheets()[0];
    }
    
    // Fitur Hapus Catatan
    if (data.action === "delete") {
      var id = data.id;
      if (id && id.indexOf("row_") === 0) {
        var rowIndex = parseInt(id.replace("row_", ""), 10);
        if (!isNaN(rowIndex) && rowIndex > 0) {
          sheet.deleteRow(rowIndex + 1);
          return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Catatan berhasil dihapus" }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "ID tidak valid" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var fileUrl = "";
    if (data.photoBase64) {
      try {
        var base64Data = data.photoBase64.split(",")[1] || data.photoBase64;
        var decoded = Utilities.base64Decode(base64Data);
        var blob = Utilities.newBlob(decoded, "image/jpeg", "bukti_" + data.nama.replace(/\\s+/g, "_") + "_" + Date.now() + ".jpg");
        
        var folders = DriveApp.getFoldersByName("Bukti_Foto_Absensi");
        var folder;
        if (folders.hasNext()) {
          folder = folders.next();
        } else {
          folder = DriveApp.createFolder("Bukti_Foto_Absensi");
        }
        
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        fileUrl = file.getUrl();
      } catch (uploadErr) {
        fileUrl = "Gagal upload: " + uploadErr.toString();
      }
    } else if (data.uploadBukti) {
      fileUrl = data.uploadBukti;
    }
    
    var headers = sheet.getDataRange().getValues()[0] || [];
    var idxNama = headers.indexOf("NAMA");
    var idxStatus = headers.indexOf("STATUS");
    var idxKeterangan = headers.indexOf("KETERANGAN");
    var idxUploadBukti = headers.indexOf("UPLOAD BUKTI");
    var idxTanggal = headers.indexOf("TANGGAL");
    
    if (idxNama === -1) idxNama = 0;
    if (idxStatus === -1) idxStatus = 1;
    if (idxKeterangan === -1) idxKeterangan = 2;
    if (idxUploadBukti === -1) idxUploadBukti = 3;
    if (idxTanggal === -1) idxTanggal = 4;
    
    var rowData = [];
    rowData[idxNama] = data.nama;
    rowData[idxStatus] = data.keterangan;
    rowData[idxKeterangan] = data.catatan || "";
    rowData[idxUploadBukti] = fileUrl;
    rowData[idxTanggal] = data.tanggal;
    
    for (var i = 0; i < Math.max(idxNama, idxStatus, idxKeterangan, idxUploadBukti, idxTanggal) + 1; i++) {
      if (rowData[i] === undefined) rowData[i] = "";
    }
    
    sheet.appendRow(rowData);
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", fileUrl: fileUrl }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  // Copy code utility
  const handleCopyCode = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopiedCode(true);
    showNotification('Kode Apps Script berhasil disalin ke clipboard!');
    setTimeout(() => setCopiedCode(false), 3000);
  };

  // Auth initialization (Local only)
  useEffect(() => {
    const savedUserStr = localStorage.getItem('local_user_session');
    if (savedUserStr) {
      try {
        const savedUser = JSON.parse(savedUserStr) as AppUser;
        setUser(savedUser);
        setNeedsAuth(false);
      } catch (err) {
        console.error('Error restoring session:', err);
        setNeedsAuth(true);
      }
    } else {
      setNeedsAuth(true);
    }

    // Load initial records from localStorage
    const savedRecordsStr = localStorage.getItem('local_attendance_records');
    if (savedRecordsStr) {
      try {
        setRecords(JSON.parse(savedRecordsStr));
      } catch (e) {
        console.error('Error parsing saved records', e);
      }
    }
  }, []);

  // Sync Google Sheet from Apps Script
  const syncFromGoogleSheet = async (urlToSync: string) => {
    if (!urlToSync) return;
    setIsSyncing(true);
    try {
      const response = await fetch(urlToSync);
      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success' && Array.isArray(result.data)) {
          // Sort by date or show row order reversed (latest first)
          const sorted = result.data.reverse();
          setRecords(sorted);
          localStorage.setItem('local_attendance_records', JSON.stringify(sorted));
          showNotification('Berhasil menyinkronkan data dari Google Sheets!');
        } else {
          showNotification('Gagal memuat data dari Spreadsheet. Pastikan kode Apps Script sudah benar.', 'error');
        }
      } else {
        showNotification('Gagal menghubungi Web App. Periksa apakah URL sudah benar.', 'error');
      }
    } catch (err) {
      console.error('Error syncing:', err);
      showNotification('Gagal sinkronisasi. Pastikan URL valid dan CORS aktif di Apps Script.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Load sheet data on webAppUrl presence
  useEffect(() => {
    if (webAppUrl && user) {
      syncFromGoogleSheet(webAppUrl);
    }
  }, [webAppUrl, user]);

  // Handle Login (Direct Local Login)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginNama.trim()) {
      showNotification('Silakan masukkan nama lengkap Anda.', 'error');
      return;
    }

    const isUserAdmin = loginNama.trim().toLowerCase() === 'arnof 11' && loginPassword === 'arnof11';
    const isUserAnggota = loginPassword === '1234';

    if (!isUserAdmin && !isUserAnggota) {
      if (loginNama.trim().toLowerCase() === 'arnof 11') {
        showNotification('Password Admin salah! Gunakan password "arnof11".', 'error');
      } else {
        showNotification('Password salah! Gunakan "1234" untuk Anggota, atau login dengan Nama "arnof 11" & Password "arnof11" untuk Admin.', 'error');
      }
      return;
    }

    setIsLoggingIn(true);
    try {
      const sessionUser: AppUser = {
        displayName: loginNama,
        email: isUserAdmin ? 'admin@absensi.local' : 'anggota@absensi.local',
        isGoogleConnected: false,
        isAdmin: isUserAdmin,
      };

      localStorage.setItem('local_user_session', JSON.stringify(sessionUser));
      setUser(sessionUser);
      setNeedsAuth(false);
      showNotification(
        isUserAdmin
          ? `Selamat datang, ${loginNama}! Masuk sebagai Administrator.`
          : `Selamat datang, ${loginNama}! Masuk sebagai Anggota.`
      );
    } catch (err: any) {
      console.error('Login error:', err);
      showNotification('Gagal masuk. Silakan coba lagi.', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Save Apps Script URL
  const handleSaveWebAppUrl = () => {
    const cleanUrl = tempUrlInput.trim();
    if (cleanUrl && !cleanUrl.startsWith('https://script.google.com/')) {
      showNotification('URL harus berupa URL Google Apps Script yang valid.', 'error');
      return;
    }

    setWebAppUrl(cleanUrl);
    localStorage.setItem('apps_script_web_app_url', cleanUrl);
    setShowSettings(false);
    if (cleanUrl) {
      showNotification('URL Google Sheets berhasil disimpan! Memulai sinkronisasi...');
      syncFromGoogleSheet(cleanUrl);
    } else {
      showNotification('Google Sheets dinonaktifkan. Mode Penyimpanan Lokal aktif.');
    }
  };

  // Logout click handler
  const handleLogout = () => {
    const confirmLogout = window.confirm('Apakah Anda yakin ingin keluar dari aplikasi?');
    if (!confirmLogout) return;

    localStorage.removeItem('local_user_session');
    setUser(null);
    setNeedsAuth(true);
    setRecords([]);
    showNotification('Anda telah berhasil keluar dari aplikasi.');
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
      const uuid = 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      let photoBase64 = '';

      if (formData.photoBlob) {
        photoBase64 = await blobToBase64(formData.photoBlob);
      }

      const activeUrl = localStorage.getItem('apps_script_web_app_url') || '';

      if (activeUrl) {
        showNotification('Sedang mengirim absensi ke Google Sheets...');
        
        // Prepare payload for Apps Script
        const payload = {
          nama: formData.nama,
          keterangan: formData.keterangan, // Matches STATUS column
          catatan: formData.catatan,       // Matches KETERANGAN column
          photoBase64: photoBase64,
          tanggal: formData.tanggal
        };

        try {
          // Send to Apps Script using text/plain to bypass complex CORS preflight issues
          await fetch(activeUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
              'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(payload)
          });
        } catch (postErr) {
          console.warn('POST response redirect or CORS error handled, data sent.', postErr);
        }
      }

      // Create new record for instant local UI feedback
      const newRecord: AttendanceRecord = {
        id: uuid,
        tanggal: formData.tanggal,
        nama: formData.nama,
        keterangan: formData.keterangan,
        catatan: formData.catatan,
        fotoBuktiUrl: photoBase64 || '',
        waktuAbsen: new Date().toISOString(),
        emailPenginput: user?.displayName || 'Anggota'
      };

      const updatedRecords = [newRecord, ...records];
      setRecords(updatedRecords);
      localStorage.setItem('local_attendance_records', JSON.stringify(updatedRecords));

      if (activeUrl) {
        showNotification(`Absensi ${formData.nama} berhasil dikirim ke Google Sheets!`);
        // Refresh silently after a short delay to get the latest sheet image links if any
        setTimeout(() => {
          syncFromGoogleSheet(activeUrl);
        }, 1500);
      } else {
        showNotification(`Absensi ${formData.nama} disimpan secara lokal (Offline Mode).`);
      }

    } catch (err: any) {
      console.error('Submit attendance error:', err);
      showNotification('Gagal menyimpan absensi. Silakan coba lagi.', 'error');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Deleting attendance record
  const handleDeleteAttendance = async (id: string) => {
    const confirmDelete = window.confirm('Apakah Anda yakin ingin menghapus catatan absensi ini?');
    if (!confirmDelete) return;

    setIsDeletingId(id);
    try {
      const activeUrl = localStorage.getItem('apps_script_web_app_url') || '';
      
      if (activeUrl) {
        showNotification('Sedang menghapus data dari Google Sheets...');
        
        const payload = {
          action: 'delete',
          id: id
        };

        try {
          await fetch(activeUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
              'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(payload)
          });
        } catch (postErr) {
          console.warn('POST response redirect or CORS error handled, deletion request sent.', postErr);
        }
      }

      // Local UI update instantly for instant feedback
      const updatedRecords = records.filter(r => r.id !== id);
      setRecords(updatedRecords);
      localStorage.setItem('local_attendance_records', JSON.stringify(updatedRecords));

      if (activeUrl) {
        showNotification('Catatan absensi berhasil dihapus!');
        // Refresh silently after a short delay
        setTimeout(() => {
          syncFromGoogleSheet(activeUrl);
        }, 1500);
      } else {
        showNotification('Catatan absensi dihapus secara lokal.');
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      showNotification('Gagal menghapus data. Silakan coba lagi.', 'error');
    } finally {
      setIsDeletingId(null);
    }
  };

  // Filter records based on role
  const displayedRecords = user?.isAdmin
    ? records
    : records.filter(
        (rec) => (rec.nama || '').toLowerCase().trim() === (user?.displayName || '').toLowerCase().trim()
      );

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
              Sistem pencatatan absensi sederhana dengan dukungan sinkronisasi Google Sheets.
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

            <div className="mt-5 pt-4 border-t border-teal-50 space-y-2 text-center text-[9px] text-teal-700/80 font-black uppercase tracking-wider">
              <div className="flex items-center justify-center gap-1">
                <Lock className="h-3 w-3 text-teal-600" /> PETUNJUK AKSES LOGIN:
              </div>
              <div className="flex flex-col gap-1.5 mt-1">
                <div className="flex justify-center items-center gap-1">
                  <span>🔑 ANGGOTA &rarr; PASSWORD: <strong className="text-teal-950 font-black">1234</strong> (Bebas Nama)</span>
                </div>
                <div className="flex justify-center items-center gap-1">
                  <span>🛡️ ADMIN &rarr; NAMA: <strong className="text-teal-950 font-black">arnof 11</strong> &bull; PASSWORD: <strong className="text-teal-950 font-black">arnof11</strong></span>
                </div>
              </div>
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
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-sm font-black text-teal-950 uppercase tracking-wide leading-tight">Absensi Anggota</h1>
                    {user?.isAdmin && (
                      <span className="bg-rose-50 text-rose-700 border border-rose-100 px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">
                        Admin
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-teal-600 font-black tracking-widest uppercase">
                    {webAppUrl ? 'Google Sheet Connected' : 'Local Storage Mode'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    setTempUrlInput(webAppUrl);
                    setShowSettings(!showSettings);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-black rounded-xl border-2 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 ${
                    webAppUrl 
                      ? 'bg-teal-50 hover:bg-teal-100 border-teal-200 text-teal-800' 
                      : 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-800'
                  }`}
                  title="Hubungkan Google Sheets"
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Pengaturan Sheet</span>
                </button>

                {webAppUrl && (
                  <button
                    onClick={() => syncFromGoogleSheet(webAppUrl)}
                    disabled={isSyncing}
                    className="p-2 bg-slate-50 border-2 border-slate-150 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer active:scale-95 shrink-0"
                    title="Sinkronisasi Ulang"
                  >
                    <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  </button>
                )}

                {/* User Profile & Logout */}
                {user && (
                  <div className="flex items-center gap-2.5 bg-slate-50 border-2 border-slate-150 rounded-2xl p-1 pr-2.5 shrink-0">
                    <div className={`h-7 w-7 rounded-lg text-white flex items-center justify-center text-xs font-black ${user.isAdmin ? 'bg-rose-600' : 'bg-teal-600'}`}>
                      {user.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="hidden md:flex flex-col text-left">
                      <span className="text-xs font-black text-slate-800 truncate max-w-[100px] leading-tight">
                        {user.displayName}
                      </span>
                      <span className="text-[8px] font-bold text-slate-500 uppercase leading-none mt-0.5">
                        {user.isAdmin ? 'Administrator' : 'Anggota'}
                      </span>
                    </div>
                    <button
                      onClick={handleLogout}
                      title="Keluar"
                      className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all cursor-pointer ml-1"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Settings / Apps Script Integration Panel */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-teal-50/50 border-b-2 border-teal-100 overflow-hidden"
              >
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-base font-black text-teal-950 uppercase tracking-wide">Pengaturan Integrasi Google Sheets</h2>
                      <p className="text-xs text-teal-800 font-bold mt-1">
                        Ikuti langkah mudah di bawah ini untuk menghubungkan aplikasi absensi ini dengan Google Spreadsheet Anda secara langsung!
                      </p>
                    </div>
                    <button 
                      onClick={() => setShowSettings(false)}
                      className="text-xs font-black text-teal-800 hover:text-teal-950 underline"
                    >
                      Tutup
                    </button>
                  </div>

                  {/* 5 Easy Steps Guide */}
                  <div className="bg-white border-2 border-teal-100 rounded-2xl p-5 space-y-4 shadow-sm text-xs text-slate-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-3">
                        <h3 className="font-black text-teal-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-teal-600" /> Langkah Penyusunan (Hanya 1 Menit)
                        </h3>
                        <ol className="list-decimal list-inside space-y-2 font-medium">
                          <li>Buka Google Spreadsheet target Anda.</li>
                          <li>Pergi ke menu atas dan pilih <span className="font-bold text-teal-800">Ekstensi &gt; Apps Script</span>.</li>
                          <li>Hapus semua kode bawaan, lalu <span className="font-bold text-teal-800">salin dan tempel kode di samping</span>.</li>
                          <li>Klik tombol <span className="font-bold text-teal-800">Terapkan &gt; Penerapan baru</span> di kanan atas.</li>
                          <li>Pilih jenis <span className="font-bold text-teal-800">Aplikasi Web</span>, isi konfigurasi:
                            <ul className="list-disc list-inside ml-5 mt-1 text-slate-600 space-y-0.5">
                              <li>Jalankan sebagai: <span className="font-bold">Saya (Email Anda)</span></li>
                              <li>Siapa yang memiliki akses: <span className="font-bold">Siapa saja (Anyone)</span></li>
                            </ul>
                          </li>
                          <li>Klik <span className="font-bold text-teal-800">Terapkan</span>, selesaikan izin dari Google, lalu salin <span className="font-bold text-teal-800">URL Aplikasi Web</span> ke input di bawah!</li>
                        </ol>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-teal-950 text-[10px] uppercase tracking-wider">Salin Kode Apps Script</span>
                          <button
                            onClick={handleCopyCode}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-[10px] transition-all cursor-pointer shadow-sm active:scale-95"
                          >
                            {copiedCode ? <Check className="h-3 w-3" /> : <Clipboard className="h-3 w-3" />}
                            {copiedCode ? 'Tersalin' : 'Salin Kode'}
                          </button>
                        </div>
                        <div className="relative">
                          <pre className="w-full h-44 overflow-y-auto bg-slate-900 text-teal-300 font-mono text-[10px] p-3 rounded-xl border border-slate-800 whitespace-pre">
                            {appsScriptCode}
                          </pre>
                        </div>
                      </div>
                    </div>

                    {/* Web App URL Input Form */}
                    <div className="pt-3 border-t border-teal-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-[10px] font-black text-teal-900 uppercase tracking-wider mb-1">
                          Google Apps Script Web App URL
                        </label>
                        <input
                          type="text"
                          placeholder="https://script.google.com/macros/s/.../exec"
                          value={tempUrlInput}
                          onChange={(e) => setTempUrlInput(e.target.value)}
                          className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-700 text-xs focus:border-teal-400 focus:bg-white outline-none transition-all"
                        />
                      </div>
                      <button
                        onClick={handleSaveWebAppUrl}
                        className="sm:self-end px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Database className="h-4 w-4" /> Hubungkan
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Dashboard Space */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            
            {/* Form and List Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Input Form */}
              <div className="lg:col-span-5 space-y-6">
                <AttendanceForm
                  onSubmit={handleAttendanceSubmit}
                  isSubmitting={isSubmitting}
                  initialNama={user?.displayName || ''}
                  isAdmin={user?.isAdmin}
                />
              </div>

              {/* Right Column: Attendance Records */}
              <div className="lg:col-span-7 h-full">
                <AttendanceList
                  records={displayedRecords}
                  isLoading={isSyncing}
                  onDelete={handleDeleteAttendance}
                  isDeletingId={isDeletingId}
                  isAdmin={user?.isAdmin}
                  userDisplayName={user?.displayName}
                />
              </div>

            </div>
          </main>

          {/* Footer Bar */}
          <footer className="border-t-2 border-teal-100 bg-white py-5 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-[10px] text-teal-800 font-black uppercase tracking-wider">
              Absensi Anggota &bull; Terhubung Google Sheets Tanpa Hambatan &bull; {new Date().getFullYear()}
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
