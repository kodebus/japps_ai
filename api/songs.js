module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { artist } = req.query;
  if (!artist || !artist.trim()) return res.status(400).json({ error: 'No artist provided' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'API key not configured' });

  const prompt = `List 8 well-known songs by "${artist.trim()}". Return ONLY valid JSON, no markdown, no explanation:
{"songs":["Song Title 1","Song Title 2","Song Title 3","Song Title 4","Song Title 5","Song Title 6","Song Title 7","Song Title 8"]}
Use the real, correct song titles. If the artist has fewer than 8 well-known songs, list as many as you know.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const raw = data.content?.[0]?.text?.trim();
    if (!raw) return res.status(500).json({ error: 'No response from AI' });

    const jsonStr = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    let parsed;
    try { parsed = JSON.parse(jsonStr); } catch (e) {
      return res.status(500).json({ error: 'Could not parse AI response' });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
};
