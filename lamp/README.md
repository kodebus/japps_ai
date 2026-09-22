# 🪔 Lamp

**Short Bible stories, read aloud — in English and Spanish.**

Live: [japps.ai/lamp](https://www.japps.ai/lamp/)

Lamp is a small, calm web app for a few quiet minutes with Scripture. Each story includes:

- **The story** — a short retelling to set the scene
- **The passage** — the actual verses (King James Version or Reina-Valera 1909)
- **What it means** — a plain explanation
- **Why we do good** — the reason the story gives for choosing kindness, forgiveness, or courage
- **Take it with you** — one line to remember, plus a short prayer

## Features

- 26 stories, with a new one featured each day
- English / Español toggle for the whole app, including the Bible text and the read-aloud voice
- Read-aloud with the current sentence highlighted; tap any sentence to start there
- Natural AI voices built in (pre-recorded with OpenAI text-to-speech), with the phone's own voices as a fallback
- A Settings menu (language, voice, speed, text size, light/dark) and a separate Help menu
- Filter by theme: Trust, Hope, Kindness, Forgiveness, Grace, Courage, Generosity, Faithfulness, Gratitude
- Save favorite stories
- Installs to the home screen and works offline
- Light and dark mode

## Privacy

Lamp has no accounts, analytics, or backend. Saved stories and settings stay on the user's device. See [privacy.html](privacy.html).

## Bible text

Passages come from the King James Version and the Reina-Valera 1909, both in the public domain.

## Tech

A single self-contained `index.html` (HTML, CSS, and vanilla JavaScript) using the browser's built-in Web Speech API. `sw.js` provides offline support and `manifest.webmanifest` makes it installable.

## Recording the natural voices

`make-voices.mjs` pre-records one small MP3 per sentence into `audio/` using OpenAI text-to-speech. Run it on your computer from this folder (Node 18+):

```bash
node make-voices.mjs --dry-run                 # what it would record, plus a cost estimate
OPENAI_API_KEY=sk-... node make-voices.mjs     # record everything missing or changed
```

Re-run it after editing any story text; unchanged stories are skipped. Never commit your API key. The voices are AI-generated, and the app says so in Settings, Help, and the player.

When you publish an update, bump `VERSION` at the top of `sw.js` (for example `lamp-v1` → `lamp-v2`) so installed copies refresh.

---

Made by [Japps.ai](https://japps.ai)
