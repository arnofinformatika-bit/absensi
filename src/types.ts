export interface AttendanceRecord {
  id: string;
  tanggal: string; // YYYY-MM-DD
  nama: string;
  keterangan: 'Hadir' | 'Izin' | 'Sakit' | 'Alpa';
  catatan: string;
  fotoBuktiUrl: string; // Google Drive Web View Link
  waktuAbsen: string; // ISO String or Locale string
  emailPenginput: string;
}

export interface SheetConfig {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  folderId: string | null;
  status: 'loading' | 'configured' | 'error' | 'not_found' | 'not_connected';
}

export interface AppUser {
  displayName: string;
  email: string;
  photoURL?: string | null;
  isGoogleConnected: boolean;
  isAdmin?: boolean;
}

