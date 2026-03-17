// api/checkup-append.js
// Simpan hasil Business AI Checkup ke Google Sheets — tab terpisah "Checkup Leads"

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    name, business, wa, role,
    score, score_label,
    industry, biz_model, revenue, employees,
    ai_interest, ai_exp, timeline,
    automation_wish, bottlenecks,
    monthly_inefficiency, time_wasted,
    recommendation
  } = req.body || {};

  if (!name || !wa) return res.status(400).json({ error: 'Missing required data' });

  const SPREADSHEET_ID = process.env.GSHEET_CONTENT_ID;
  const SERVICE_ACCOUNT = process.env.GSHEET_SERVICE_ACCOUNT;
  if (!SPREADSHEET_ID || !SERVICE_ACCOUNT) {
    return res.status(500).json({ error: 'Google Sheets not configured' });
  }

  const SHEET_NAME = 'Checkup Leads';

  try {
    const sa = JSON.parse(SERVICE_ACCOUNT);
    const token = await getAccessToken(sa);
    const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    // ── Pastikan sheet "Checkup Leads" ada ──
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const meta = await metaRes.json();
    const sheets = meta.sheets || [];
    const sheetExists = sheets.some(s => s.properties.title === SHEET_NAME);

    if (!sheetExists) {
      // Buat sheet baru
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{ addSheet: { properties: { title: SHEET_NAME } } }]
          })
        }
      );
    }

    // ── Auto-tulis header kalau belum ada ──
    const checkRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A1`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const checkData = await checkRes.json();
    const hasHeader = checkData.values?.[0]?.[0] === 'Tanggal';

    if (!hasHeader) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A1:N1?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            values: [[
              'Tanggal', 'Nama', 'Bisnis', 'WhatsApp', 'Jabatan',
              'Skor', 'Label Skor', 'Industri', 'Model Bisnis',
              'Omzet/Bulan', 'Karyawan', 'Minat AI', 'Pengalaman AI',
              'Timeline', 'Ingin Otomasi', 'Bottleneck Utama',
              'Inefisiensi/Bulan', 'Waktu Terbuang/Bulan', 'Rekomendasi AI'
            ]]
          })
        }
      );
    }

    // ── Append row ──
    const row = [
      now, name, business, wa, role || '',
      score, score_label,
      industry || '', biz_model || '', revenue || '', employees || '',
      ai_interest || '', ai_exp || '', timeline || '',
      automation_wish || '', bottlenecks || '',
      monthly_inefficiency || '', time_wasted || '',
      (recommendation || '').substring(0, 500)
    ];

    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}!A:S:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] })
      }
    );

    if (!appendRes.ok) {
      const err = await appendRes.text();
      return res.status(500).json({ error: 'Failed to append', detail: err });
    }

    // ── Auto-format sheet ──
    const updatedMeta = await (await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )).json();

    const sheetId = updatedMeta.sheets.find(s => s.properties.title === SHEET_NAME)?.properties?.sheetId;

    if (sheetId !== undefined) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [
              // Wrap text semua kolom
              {
                repeatCell: {
                  range: { sheetId, startRowIndex: 1 },
                  cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP' } },
                  fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)'
                }
              },
              // Lebar kolom
              ...[[0,150],[1,160],[2,180],[3,140],[4,120],[5,60],[6,120],[7,120],[8,120],[9,100],[10,80],[11,100],[12,100],[13,100],[14,200],[15,200],[16,120],[17,120],[18,400]].map(([idx, px]) => ({
                updateDimensionProperties: {
                  range: { sheetId, dimension: 'COLUMNS', startIndex: idx, endIndex: idx + 1 },
                  properties: { pixelSize: px },
                  fields: 'pixelSize'
                }
              })),
              // Bold + warna header
              {
                repeatCell: {
                  range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                  cell: {
                    userEnteredFormat: {
                      textFormat: { bold: true, fontSize: 10 },
                      backgroundColor: { red: 0.1, green: 0.34, blue: 0.86 },
                      horizontalAlignment: 'CENTER',
                      textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
                    }
                  },
                  fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)'
                }
              },
              // Freeze header
              {
                updateSheetProperties: {
                  properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
                  fields: 'gridProperties.frozenRowCount'
                }
              }
            ]
          })
        }
      );
    }

    return res.status(200).json({ ok: true });

  } catch(err) {
    console.error('checkup-append error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ── JWT Auth (sama persis seperti sheets-append.js) ──
async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600
  };

  const encode = obj => btoa(JSON.stringify(obj)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const toSign = `${encode(header)}.${encode(payload)}`;

  const keyData = sa.private_key
    .replace('-----BEGIN PRIVATE KEY-----','')
    .replace('-----END PRIVATE KEY-----','')
    .replace(/\n/g,'');

  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(toSign));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const jwt = `${toSign}.${sigB64}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error('Failed to get access token');
  return tokenData.access_token;
}
