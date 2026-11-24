module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { artist } = req.query;
  if (!artist || !artist.trim()) return res.status(400).json({ error: 'No artist provided' });

  try {
    const artistQuery = encodeURIComponent(artist.trim());

    // Step 1: Search for the artist on MusicBrainz
    const artistRes = await fetch(
      `https://musicbrainz.org/ws/2/artist/?query=artist:${artistQuery}&limit=1&fmt=json`,
      { headers: { 'User-Agent': 'IvoryPianoApp/1.0 (gsselle@japps.ai)' } }
    );
    const artistData = await artistRes.json();
    const artists = artistData.artists || [];
    if (!artists.length) return res.status(200).json({ songs: [] });

    const artistId = artists[0].id;

    // Step 2: Get recordings (songs) for that artist
    const recordingsRes = await fetch(
      `https://musicbrainz.org/ws/2/recording/?artist=${artistId}&limit=100&fmt=json`,
      { headers: { 'User-Agent': 'IvoryPianoApp/1.0 (gsselle@japps.ai)' } }
    );
    const recordingsData = await recordingsRes.json();
    const recordings = recordingsData.recordings || [];

    // Deduplicate by lowercase title, sort alphabetically
    const seen = new Set();
    const songs = recordings
      .map(r => r.title)
      .filter(t => {
        const key = t.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.localeCompare(b));

    return res.status(200).json({ songs });
  } catch (err) {
    return res.status(500).json({ error: 'Could not fetch songs', detail: err.message });
  }
};
