// api/checkup-analyze.js
// Proxy ke Anthropic Claude Haiku untuk generate AI Efficiency Report

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'API key not configured' });

  const SYSTEM = `Kamu adalah konsultan transformasi digital senior spesialis implementasi AI untuk bisnis Indonesia.

INSTRUKSI PENTING:
- Output HANYA berupa JSON valid, tidak ada teks lain SAMA SEKALI
- Jangan tambahkan kalimat pembuka, penutup, atau penjelasan apapun
- Jangan gunakan markdown code fence (backtick)
- Langsung mulai dengan karakter { dan akhiri dengan }
- Semua estimasi harus realistis untuk konteks bisnis Indonesia
- Gunakan bahasa Indonesia yang formal dan profesional`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2500,
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', err);
      return res.status(500).json({ error: 'Anthropic API error', detail: err });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    return res.status(200).json({ text });

  } catch (err) {
    console.error('checkup-analyze error:', err);
    return res.status(500).json({ error: err.message });
  }
}
