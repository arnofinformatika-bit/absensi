import { AttendanceRecord } from './types';

// Helper: Convert Data URL (Base64) to Blob
export function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

// Search for a file/folder in Google Drive
async function searchDriveFile(accessToken: string, query: string): Promise<any[]> {
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)&pageSize=5`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Gagal mencari file di Drive: ${res.statusText}`);
  }
  const data = await res.json();
  return data.files || [];
}

// Find or create Spreadsheet "Absensi Anggota"
export async function findOrCreateSpreadsheet(accessToken: string): Promise<{ spreadsheetId: string; webViewLink: string }> {
  const spreadsheetId = '1VI2W4eb2VE44xJvAQ4gouPyFxQ35qcyE5j4Xup8oHLc';
  const webViewLink = 'https://docs.google.com/spreadsheets/d/1VI2W4eb2VE44xJvAQ4gouPyFxQ35qcyE5j4Xup8oHLc/edit?usp=sharing';

  try {
    // Check if "Sheet1" sheet tab exists in this spreadsheet
    const checkUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
    const checkRes = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (checkRes.ok) {
      const data = await checkRes.json();
      const sheets = data.sheets || [];
      const hasSheet1 = sheets.some((s: any) => s.properties?.title === 'Sheet1');

      if (!hasSheet1) {
        // Create "Sheet1" sheet tab if it's missing (though it exists in user screenshot)
        const addSheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'Sheet1',
                  },
                },
              },
            ],
          }),
        });

        if (addSheetRes.ok) {
          // Write headers to the new "Sheet1" sheet tab
          const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:E1?valueInputOption=USER_ENTERED`;
          await fetch(writeUrl, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              values: [
                ['NAMA', 'STATUS', 'KETERANGAN', 'UPLOAD BUKTI', 'TANGGAL'],
              ],
            }),
          });
        }
      }
    }
  } catch (err) {
    console.error('Error verifying/creating Sheet1:', err);
  }

  return { spreadsheetId, webViewLink };
}

// Find or create Folder "Bukti_Foto_Absensi"
export async function findOrCreateFolder(accessToken: string): Promise<string> {
  const existing = await searchDriveFile(
    accessToken,
    "name = 'Bukti_Foto_Absensi' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
  );

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Create folder
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Bukti_Foto_Absensi',
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!res.ok) {
    throw new Error(`Gagal membuat folder bukti foto: ${res.statusText}`);
  }

  const data = await res.json();
  return data.id;
}

// Upload photo blob to Drive, grant anyone reader access, and get view link
export async function uploadPhotoToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  fileBlob: Blob
): Promise<{ fileId: string; webViewLink: string }> {
  // 1. Create file metadata in parent folder
  const metaRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: fileName,
      mimeType: fileBlob.type,
      parents: [folderId],
    }),
  });

  if (!metaRes.ok) {
    const errText = await metaRes.text();
    throw new Error(`Gagal membuat metadata file di Drive: ${errText}`);
  }

  const metaData = await metaRes.json();
  const fileId = metaData.id;

  // 2. Upload file content media
  const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
  const uploadRes = await fetch(uploadUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': fileBlob.type,
    },
    body: fileBlob,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Gagal mengunggah konten foto ke Drive: ${errText}`);
  }

  // 3. Grant anyone reader permission
  try {
    const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });
    if (!permRes.ok) {
      console.warn('Gagal memberi akses publik ke foto. Foto mungkin hanya bisa diakses oleh pemilik.');
    }
  } catch (err) {
    console.error('Error saat mengatur hak akses file:', err);
  }

  // 4. Fetch the full file detail to get webViewLink
  const getRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,webViewLink,thumbnailLink`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  if (getRes.ok) {
    const fileInfo = await getRes.json();
    return {
      fileId,
      webViewLink: fileInfo.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    };
  }

  return {
    fileId,
    webViewLink: `https://drive.google.com/file/d/${fileId}/view`,
  };
}

// Append attendance record to Spreadsheet
export async function addAttendanceRecord(
  accessToken: string,
  spreadsheetId: string,
  record: AttendanceRecord
): Promise<void> {
  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:E:append?valueInputOption=USER_ENTERED`;
  
  const res = await fetch(appendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [
        [
          record.nama,
          record.keterangan,
          record.catatan,
          record.fotoBuktiUrl,
          record.tanggal,
        ],
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal menyimpan absensi ke Spreadsheet: ${errText}`);
  }
}

// Fetch list of attendance records from Spreadsheet
export async function fetchAttendanceRecords(
  accessToken: string,
  spreadsheetId: string
): Promise<AttendanceRecord[]> {
  const fetchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A2:E1000`;
  const res = await fetch(fetchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    // If the tab or range doesn't exist yet, return empty list
    return [];
  }

  const data = await res.json();
  const rows = data.values || [];

  return rows.map((row: any, idx: number) => ({
    id: (row[0] || 'id') + '_' + idx + '_' + (row[4] || ''),
    nama: row[0] || '',
    keterangan: (row[1] || 'Hadir') as 'Hadir' | 'Izin' | 'Sakit' | 'Alpa',
    catatan: row[2] || '',
    fotoBuktiUrl: row[3] || '',
    tanggal: row[4] || '',
    waktuAbsen: row[4] || '',
    emailPenginput: 'Sistem Google Sheets',
  })).reverse(); // Reverse to show latest first
}
