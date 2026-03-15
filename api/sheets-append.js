// api/sheets-append.js
// Append konten ke Google Sheets — format readable, auto header, auto column width

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { topic, platform, angle, hook, content, caption } = req.body || {};
  if (!topic) return res.status(400).json({ error: 'Missing data' });

  const SPREADSHEET_ID = process.env.GSHEET_CONTENT_ID;
  const SERVICE_ACCOUNT = process.env.GSHEET_SERVICE_ACCOUNT;
  if (!SPREADSHEET_ID || !SERVICE_ACCOUNT) {
    return res.status(500).json({ error: 'Google Sheets not configured' });
  }

  const platformLabels = { instagram: 'Instagram Carousel', tiktok: 'TikTok/Reels', twitter: 'Twitter Thread' };
  const angleLabels = { pain: 'Pain Point', data: 'Data Driven', macro: 'Makro', story: 'Storytelling', contrarian: 'Contrarian', howto: 'How To' };

  try {
    const sa = JSON.parse(SERVICE_ACCOUNT);
    const token = await getAccessToken(sa);
    const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    // ── Auto-tulis header baris 1 kalau belum ada ──
    const checkRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Sheet1!A1`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const checkData = await checkRes.json();
    const hasHeader = checkData.values?.[0]?.[0] === 'Tanggal';

    if (!hasHeader) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Sheet1!A1:G1?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [['Tanggal', 'Topik', 'Platform', 'Angle', 'Hook', 'Isi Konten', 'Caption']] })
        }
      );
    }

    // ── Bersihkan newline escaped ──
    const clean = str => (str || '').replace(/\\n/g, '\n').replace(/\\t/g, ' ').trim();

    const row = [
      now,
      topic,
      platformLabels[platform] || platform,
      angleLabels[angle] || angle,
      clean(hook),
      clean(content),
      clean(caption)
    ];

    // USER_ENTERED supaya \n jadi line break di dalam sel
    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Sheet1!A:G:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
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

    // ── Auto-format: wrap text, column width, bold header ──
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const meta = await metaRes.json();
    const sheetId = meta.sheets?.[0]?.properties?.sheetId ?? 0;

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            // Wrap text + vertical align top untuk kolom E-G
            {
              repeatCell: {
                range: { sheetId, startColumnIndex: 4, endColumnIndex: 7 },
                cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP' } },
                fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)'
              }
            },
            // Vertical align top untuk semua kolom
            {
              repeatCell: {
                range: { sheetId, startRowIndex: 1 },
                cell: { userEnteredFormat: { verticalAlignment: 'TOP' } },
                fields: 'userEnteredFormat(verticalAlignment)'
              }
            },
            // Set lebar kolom
            ...[[0,150],[1,180],[2,140],[3,110],[4,240],[5,380],[6,300]].map(([idx, px]) => ({
              updateDimensionProperties: {
                range: { sheetId, dimension: 'COLUMNS', startIndex: idx, endIndex: idx + 1 },
                properties: { pixelSize: px },
                fields: 'pixelSize'
              }
            })),
            // Bold + background header
            {
              repeatCell: {
                range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                cell: {
                  userEnteredFormat: {
                    textFormat: { bold: true, fontSize: 11 },
                    backgroundColor: { red: 0.91, green: 1.0, blue: 0.28 },
                    horizontalAlignment: 'CENTER'
                  }
                },
                fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)'
              }
            },
            // Freeze baris header
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

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('sheets-append error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ── JWT Auth untuk Service Account ──
async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  const encode = obj => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const toSign = `${encode(header)}.${encode(payload)}`;

  // Import private key
  const privateKey = sa.private_key;
  const keyData = privateKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '');

  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(toSign)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const jwt = `${toSign}.${sigB64}`;

  // Exchange JWT for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(tokenData));

  return tokenData.access_token;
}
