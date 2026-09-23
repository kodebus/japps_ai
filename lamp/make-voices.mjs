#!/usr/bin/env node
// make-voices.mjs — records Lamp's natural voices ahead of time.
//
// Run it on your computer (not on the website), from inside the lamp folder:
//
//   OPENAI_API_KEY=sk-...  node make-voices.mjs            # record everything that is missing or changed
//   node make-voices.mjs --dry-run                          # just show what it would record and a cost estimate
//   OPENAI_API_KEY=sk-...  node make-voices.mjs --story=samaritan --lang=en   # one story, one language
//
// It creates  audio/<voice>/<lang>/<story>/000.mp3, 001.mp3 ...  (one short clip per sentence)
// plus        audio/index.json  which tells the app which stories have recordings.
//
// Safe to run again: stories that haven't changed are skipped. If you edit a story's text in index.html,
// only that story is re-recorded. If a recording is missing or out of date, the app quietly
// falls back to the phone's own voice for that story.
//
// Your API key is only used here on your computer. Never put it in index.html or commit it to GitHub.
// Needs Node 18 or newer.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------- settings you can change ----------
const MODEL = "gpt-4o-mini-tts";
const VOICES = {
  // id = OpenAI voice name, label = what users see in Lamp's Settings ("Lamp · Marin")
  en: [{ id: "marin", label: "Marin" }],
  es: [{ id: "marin", label: "Marin" }],
};
const INSTRUCTIONS = {
  en: "Read aloud gently and warmly, like a calm devotional reading. Unhurried pace, clear diction, reverent but not dramatic. For Bible verses, read with quiet dignity.",
  es: "Lee en voz alta en español latinoamericano neutro, con calidez y calma, como una lectura devocional serena. Ritmo pausado, dicción clara, reverente pero sin dramatismo. Para los versículos bíblicos, lee con serena dignidad.",
};
const CONCURRENCY = 4;
// ---------------------------------------------

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v === undefined ? true : v];
}));
const DRY = !!args["dry-run"];
const KEY = process.env.OPENAI_API_KEY;
if (!DRY && !KEY) {
  console.error("Missing OPENAI_API_KEY. Example:\n  OPENAI_API_KEY=sk-... node make-voices.mjs\nOr try:  node make-voices.mjs --dry-run");
  process.exit(1);
}

// Load the stories and the exact sentence-splitting rules from the app itself.
const html = await fs.readFile(path.join(here, "index.html"), "utf8");
const shared = html.slice(html.indexOf("/*SHARED-START*/"), html.indexOf("/*SHARED-END*/"));
if (!shared) { console.error("Couldn't find the SHARED block in index.html."); process.exit(1); }
const { STORIES, SAMPLE, segmentTexts, fnv } =
  new Function(shared + "\nreturn { STORIES, SAMPLE, segmentTexts, fnv };")();

const audioDir = path.join(here, "audio");
const indexPath = path.join(audioDir, "index.json");
let index = { version: 1, model: MODEL, voices: {}, stories: {} };
try { index = { ...index, ...JSON.parse(await fs.readFile(indexPath, "utf8")) }; } catch {}

const langs = args.lang ? [args.lang] : Object.keys(VOICES);
const stories = args.story ? STORIES.filter(s => s.id === args.story) : STORIES;
if (!stories.length) { console.error(`No story with id "${args.story}".`); process.exit(1); }

const exists = p => fs.access(p).then(() => true, () => false);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function tts(text, voice, lang, file) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, voice, input: text, instructions: INSTRUCTIONS[lang], response_format: "mp3" }),
    });
    if (res.ok) { await fs.writeFile(file, Buffer.from(await res.arrayBuffer())); return; }
    const body = await res.text().catch(() => "");
    if ((res.status === 429 || res.status >= 500) && attempt < 6) { await sleep(1500 * attempt); continue; }
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 300)}`);
  }
}

async function runPool(jobs) {
  let next = 0;
  const worker = async () => { while (next < jobs.length) { const j = jobs[next++]; await j(); } };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
}

const saveIndex = async () => {
  await fs.mkdir(audioDir, { recursive: true });
  await fs.writeFile(indexPath, JSON.stringify(index, null, 1));
};

let todoChars = 0, todoClips = 0, skipped = 0;
for (const lang of langs) {
  for (const v of VOICES[lang] || []) {
    // Voice list shown in the app
    index.voices[lang] = index.voices[lang] || [];
    if (!index.voices[lang].some(x => x.id === v.id)) index.voices[lang].push(v);

    // Short sample for the Preview button
    const sampleFile = path.join(audioDir, v.id, lang, "_sample.mp3");
    if (!(await exists(sampleFile))) {
      todoChars += SAMPLE[lang].length; todoClips++;
      if (!DRY) { await fs.mkdir(path.dirname(sampleFile), { recursive: true }); await tts(SAMPLE[lang], v.id, lang, sampleFile); }
    }

    for (const story of stories) {
      const texts = segmentTexts(story, lang);
      const h = fnv(texts.join("\n"));
      const key = `${v.id}/${lang}/${story.id}`;
      const dir = path.join(audioDir, v.id, lang, story.id);
      const files = texts.map((_, i) => path.join(dir, String(i).padStart(3, "0") + ".mp3"));
      const entry = index.stories[key];

      if (entry && entry.h === h && entry.n === texts.length && (await Promise.all(files.map(exists))).every(Boolean)) { skipped++; continue; }

      // Text changed (or first time): start this story fresh
      if (entry && entry.h !== h && !DRY) await fs.rm(dir, { recursive: true, force: true });
      const missing = [];
      for (let i = 0; i < texts.length; i++) if (!(entry && entry.h === h && await exists(files[i]))) missing.push(i);
      todoClips += missing.length; todoChars += missing.reduce((n, i) => n + texts[i].length, 0);

      if (DRY) { console.log(`would record  ${key}  (${missing.length} clips)`); continue; }

      await fs.mkdir(dir, { recursive: true });
      delete index.stories[key]; await saveIndex();   // mark as incomplete while recording
      process.stdout.write(`recording ${key} (${missing.length} clips) ... `);
      await runPool(missing.map(i => () => tts(texts[i], v.id, lang, files[i])));
      index.stories[key] = { h, n: texts.length };
      await saveIndex();
      console.log("done");
    }
  }
}
if (!DRY) await saveIndex();

const minutes = todoChars / 14 / 60;           // roughly 14 characters per second of calm speech
console.log(`\n${DRY ? "Would record" : "Recorded"} ${todoClips} clips, ${todoChars.toLocaleString()} characters (about ${minutes.toFixed(0)} minutes of audio).`);
console.log(`Rough cost at ~$0.015 per minute: about $${(minutes * 0.015).toFixed(2)}. Check OpenAI's pricing page for current rates.`);
if (skipped) console.log(`${skipped} stories were already up to date and skipped.`);
