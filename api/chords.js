module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { song, artist = '', style = 'fingerstyle' } = req.query;

  if (!song || !song.trim()) {
    return res.status(400).json({ error: 'No song provided' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const isFingerstyle = style === 'fingerstyle';

  const prompt = isFingerstyle
    ? `You are an expert guitarist and music transcriber. Generate a fingerstyle guitar arrangement for:
Song: "${song.trim()}"${artist ? `\nArtist: "${artist.trim()}"` : ''}

Return ONLY valid JSON (no markdown, no explanation) in this exact shape:
{
  "title": "Song Title",
  "artist": "Artist Name",
  "key": "Am",
  "bpm": 120,
  "capo": 0,
  "time_signature": "4/4",
  "chords": "[Am]Word [F]word [C]word [G]word\\n[Am]Next line [F]word [C]more [G]words",
  "fingerpicking_pattern": {
    "description": "p-i-m-a pattern — thumb plays bass, fingers arpeggiate treble strings",
    "pattern_name": "Travis Pick",
    "beat_count": 4,
    "pattern": [
      {"beat": 1, "fingers": "p", "strings": "6", "note": "Bass root"},
      {"beat": 1.5, "fingers": "i", "strings": "3", "note": ""},
      {"beat": 2, "fingers": "p", "strings": "4", "note": "Bass fifth"},
      {"beat": 2.5, "fingers": "m", "strings": "2", "note": ""},
      {"beat": 3, "fingers": "p", "strings": "6", "note": "Bass root"},
      {"beat": 3.5, "fingers": "a", "strings": "1", "note": ""},
      {"beat": 4, "fingers": "p", "strings": "4", "note": "Bass fifth"},
      {"beat": 4.5, "fingers": "i-m", "strings": "3-2", "note": ""}
    ],
    "tab_example": "e|---0---0---0---0-|\\nB|------0-------0--|\\nG|---0-------0-----|\\nD|-0-----------0---|\\nA|-----------------|\\nE|------3-------3--|",
    "tips": ["Let notes ring into each other", "Keep thumb steady on bass strings", "Use free stroke for treble strings"]
  },
  "chord_shapes": {
    "Am": {"fret": 0, "fingers": [0,0,2,2,1,0], "barre": false},
    "F": {"fret": 1, "fingers": [1,1,2,3,3,1], "barre": true}
  }
}

Rules:
- "chords" field: full lyrics with inline chords using [Chord] before each word, separated by \\n for new lines. Use actual song lyrics.
- Include 2-3 verses and chorus at minimum.
- chord_shapes: list every chord that appears in the song. fingers array is [e,B,G,D,A,E] from high to low string, 0=open, -1=muted, number=fret.
- bpm: realistic tempo for this song.
- capo: 0 if no capo needed, otherwise fret number.
- tab_example: 6-line ASCII tab showing one measure of the fingerpicking pattern applied to the first chord.
- pattern fingers legend: p=thumb, i=index, m=middle, a=ring.`
    : `You are an expert guitarist and music transcriber. Generate a strumming chord chart for:
Song: "${song.trim()}"${artist ? `\nArtist: "${artist.trim()}"` : ''}

Return ONLY valid JSON (no markdown, no explanation) in this exact shape:
{
  "title": "Song Title",
  "artist": "Artist Name",
  "key": "G",
  "bpm": 120,
  "capo": 0,
  "time_signature": "4/4",
  "chords": "[G]Word [D]word [Em]word [C]word\\n[G]Next line [D]word",
  "strumming_pattern": "D DU UDU",
  "chord_shapes": {
    "G": {"fret": 0, "fingers": [3,0,0,0,2,3], "barre": false},
    "D": {"fret": 0, "fingers": [2,3,2,0,-1,-1], "barre": false}
  }
}

Rules:
- "chords" field: full lyrics with inline chords using [Chord] before each word, separated by \\n for new lines. Use actual song lyrics.
- Include 2-3 verses and chorus at minimum.
- chord_shapes: list every chord that appears. fingers array is [e,B,G,D,A,E] from high to low string, 0=open, -1=muted.
- bpm: realistic tempo.
- capo: 0 if none, otherwise fret number.
- strumming_pattern: use D (down) U (up) notation.`;

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
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const raw = data.content?.[0]?.text?.trim();

    if (!raw) {
      return res.status(500).json({ error: 'No response from AI' });
    }

    const jsonStr = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error('JSON parse error:', e, 'Raw:', jsonStr.slice(0, 500));
      return res.status(500).json({ error: 'Could not parse AI response as JSON' });
    }

    parsed.style = style;

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Chords API error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};
