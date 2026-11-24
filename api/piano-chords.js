module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { song, artist } = req.query;
  if (!song || !song.trim()) return res.status(400).json({ error: 'No song provided' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'API key not configured' });

  const artistPart = artist ? ` by ${artist.trim()}` : '';
  const prompt = `You are a piano teacher. For the song "${song.trim()}"${artistPart}, provide piano chord information.
Return ONLY valid JSON with no markdown, no explanation, in exactly this format:
{
  "song": "exact song title",
  "artist": "artist name",
  "key": "key of the song (e.g. C major, A minor)",
  "tempo": "slow/medium/fast",
  "difficulty": "beginner/intermediate/advanced",
  "chords": [
    {
      "name": "chord name (e.g. C, Am, F, G7)",
      "notes": ["C4", "E4", "G4"],
      "fingers": "brief finger position tip for piano",
      "role": "tonic/subdominant/dominant/other"
    }
  ],
  "progression": "chord progression as string (e.g. C - Am - F - G)",
  "tips": "one helpful piano-specific tip for playing this song"
}
Include 4-6 chords. Use scientific pitch notation for notes (e.g. C4, D#4, G4). Use sharps not flats (A# not Bb, D# not Eb). Focus on the most common chords used throughout the song.`;

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
        max_tokens: 1024,
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
