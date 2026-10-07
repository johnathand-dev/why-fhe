#!/usr/bin/env node
// Generate the narration and the music bed from ElevenLabs, then report how the
// lines actually landed against the bar grid.
//
// Everything is cached by a hash of the request, so re-running is free unless
// the text, the voice settings or the music prompt changed. That matters: this
// spends real credits, and the render loop calls it every time.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { LINES, MUSIC_PROMPT, VOICE, BAR, SCENE_BARS } from './script.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'out');
const API = 'https://api.elevenlabs.io/v1';

const args = new Set(process.argv.slice(2));
const FORCE = args.has('--force');
const SKIP_MUSIC = args.has('--no-music');

/** Total video length in seconds, from the scene table. */
const TOTAL = SCENE_BARS.reduce((m, s) => Math.max(m, s.start + s.length), 0) * BAR;

async function loadApiKey() {
    const envPath = path.join(here, '..', '..', '.env');
    const raw = await readFile(envPath, 'utf8').catch(() => '');
    const m = raw.match(/^ELEVENLABS_API_KEY\s*=\s*(.+)$/m);
    const key = (m?.[1] ?? process.env.ELEVENLABS_API_KEY ?? '').trim().replace(/^["']|["']$/g, '');
    if (!key) throw new Error('ELEVENLABS_API_KEY not found in .env or environment');
    return key;
}

const exists = (f) => stat(f).then(() => true).catch(() => false);

function probeDuration(file) {
    return new Promise((resolve, reject) => {
        const c = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
        let out = '';
        c.stdout.on('data', (d) => (out += d));
        c.on('close', (code) => {
            const n = Number(out.trim());
            if (code !== 0 || !Number.isFinite(n)) reject(new Error(`ffprobe failed: ${file}`));
            else resolve(n);
        });
    });
}

async function post(url, key, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`${url} -> ${res.status} ${res.statusText}\n${detail.slice(0, 500)}`);
    }
    return Buffer.from(await res.arrayBuffer());
}

const hash = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);

async function main() {
    await mkdir(outDir, { recursive: true });
    const key = await loadApiKey();

    // --- Narration ---------------------------------------------------------

    const timings = [];
    for (const line of LINES) {
        const body = {
            text: line.text,
            model_id: VOICE.model,
            voice_settings: VOICE.settings
        };
        const sig = hash({ ...body, voice: VOICE.id });
        const file = path.join(outDir, `vo-${line.id}-${sig}.mp3`);

        if (FORCE || !(await exists(file))) {
            process.stdout.write(`  tts ${line.id} … `);
            const audio = await post(
                `${API}/text-to-speech/${VOICE.id}?output_format=mp3_44100_128`,
                key,
                body
            );
            await writeFile(file, audio);
            process.stdout.write(`${(audio.length / 1024).toFixed(0)} KB\n`);
        }

        timings.push({
            id: line.id,
            bar: line.bar,
            start: line.bar * BAR,
            duration: await probeDuration(file),
            file: path.relative(here, file),
            text: line.text
        });
    }

    // --- Music -------------------------------------------------------------

    let music = null;
    if (!SKIP_MUSIC) {
        // The bed is generated a little long and trimmed at mix time, so the
        // video length can drift by a bar without a regeneration.
        const lengthMs = Math.ceil((TOTAL + 6) * 1000);
        const sig = hash({ MUSIC_PROMPT, lengthMs, model: 'music_v2' });
        const file = path.join(outDir, `music-${sig}.mp3`);
        if (FORCE || !(await exists(file))) {
            process.stdout.write(`  music ${(lengthMs / 1000).toFixed(1)}s … `);
            const audio = await post(`${API}/music?output_format=mp3_44100_128`, key, {
                prompt: MUSIC_PROMPT,
                music_length_ms: lengthMs,
                model_id: 'music_v2',
                force_instrumental: true
            });
            await writeFile(file, audio);
            process.stdout.write(`${(audio.length / 1024 / 1024).toFixed(1)} MB\n`);
        }
        music = { file: path.relative(here, file), duration: await probeDuration(file) };
    }

    // --- Report ------------------------------------------------------------
    //
    // A line that runs past the next one is not automatically wrong — speech
    // overlapping by a fraction reads fine — but a long overrun means the
    // narration and the picture have come apart, so it is called out.

    const sceneStart = (t) => {
        const s = [...SCENE_BARS].reverse().find((sc) => t >= sc.start * BAR);
        return s ? s.name : '?';
    };

    let worst = 0;
    process.stdout.write('\n  bar    start    dur   gap  line\n');
    for (let i = 0; i < timings.length; i++) {
        const t = timings[i];
        const next = timings[i + 1];
        const gap = next ? next.start - (t.start + t.duration) : TOTAL - (t.start + t.duration);
        worst = Math.min(worst, gap);
        const flag = gap < -0.35 ? '  <-- OVERRUN' : gap < 0 ? '  (tight)' : '';
        process.stdout.write(
            `  ${t.bar.toFixed(1).padStart(5)} ${t.start.toFixed(1).padStart(7)}s ` +
                `${t.duration.toFixed(1).padStart(5)}s ${gap.toFixed(1).padStart(5)}s  ` +
                `${t.id.padEnd(12)} ${sceneStart(t.start)}${flag}\n`
        );
    }

    const manifest = { bar: BAR, total: TOTAL, voice: VOICE, lines: timings, music };
    await writeFile(path.join(outDir, 'timing.json'), JSON.stringify(manifest, null, 2));

    // The last line is checked against the end of the video, not skipped. A
    // final line that runs past the fade is the easiest overrun to miss and the
    // worst one to ship, since it is usually the payoff.
    const overruns = timings.filter((t, i) => {
        const limit = timings[i + 1] ? timings[i + 1].start : TOTAL;
        return limit - (t.start + t.duration) < -0.35;
    });
    process.stdout.write(
        `\n  ${timings.length} lines, tightest gap ${worst.toFixed(2)}s, ${overruns.length} overrun(s)\n`
    );
    if (overruns.length) {
        process.stdout.write('  Shorten the text or move the following line later in script.mjs:\n');
        for (const o of overruns) process.stdout.write(`    ${o.id}\n`);
    }
}

main().catch((err) => {
    process.stderr.write(`${err.stack ?? err}\n`);
    process.exit(1);
});
