// api/sheets-append.js
// Append konten yang digenerate ke Google Sheets

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { topic, platform, angle, hook, content, caption } = req.body || {};
  if (!topic) return res.status(400).json({ error: 'Missing data' });

  const SPREADSHEET_ID = process.env.GSHEET_CONTENT_ID;
  const SERVICE_ACCOUNT = process.env.GSHEET_SERVICE_ACCOUNT; // JSON string dari file .json

  if (!SPREADSHEET_ID || !SERVICE_ACCOUNT) {
    return res.status(500).json({ error: 'Google Sheets not configured' });
  }

  try {
    // Parse service account
    const sa = JSON.parse(SERVICE_ACCOUNT);

    // Get access token via JWT
    const token = await getAccessToken(sa);

    // Append row
    const platformLabels = {
      instagram: 'Instagram Carousel',
      tiktok: 'TikTok/Reels',
      twitter: 'Twitter Thread'
    };
    const angleLabels = {
      pain: 'Pain Point',
      data: 'Data Driven',
      macro: 'Makro',
      story: 'Storytelling',
      contrarian: 'Contrarian',
      howto: 'How To'
    };

    const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const row = [
      now,
      topic,
      platformLabels[platform] || platform,
      angleLabels[angle] || angle,
      hook || '',
      content || '',
      caption || ''
    ];

    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Sheet1!A:G:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [row] })
      }
    );

    if (!appendRes.ok) {
      const err = await appendRes.text();
      console.error('Sheets append error:', err);
      return res.status(500).json({ error: 'Failed to append to sheet', detail: err });
    }

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
