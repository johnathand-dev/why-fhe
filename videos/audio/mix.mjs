#!/usr/bin/env node
// Build the finished soundtrack: music bed with the narration sitting on top of
// it, ducked out of the way whenever the voice is speaking.
//
// The duck is a sidechain compressor keyed off the voice rather than a static
// music level. A fixed level either buries the bed until it is pointless or
// leaves it fighting the narration; keying it means the music comes back up in
// the gaps, which is exactly where the picture is doing the talking.

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'out');

const MUSIC_GAIN = 0.5; // bed level before ducking
const VO_GAIN = 1.5; // narration level
const FADE_OUT = 3.0; // seconds of music fade at the tail

function run(cmd, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let err = '';
        child.stderr.on('data', (d) => (err += d));
        child.on('close', (code) =>
            code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}\n${err.slice(-2500)}`))
        );
    });
}

/**
 * @param {number} total video duration in seconds
 * @param {string} outFile path to write the mixed audio to
 */
export async function mixAudio(total, outFile) {
    const manifest = JSON.parse(await readFile(path.join(outDir, 'timing.json'), 'utf8'));
    const { lines, music } = manifest;
    if (!music) throw new Error('no music in timing.json — run generate.mjs without --no-music');

    const inputs = ['-i', path.join(here, music.file)];
    for (const l of lines) inputs.push('-i', path.join(here, l.file));

    // Each line is delayed to its start and the lot summed into one voice bus.
    const parts = [];
    lines.forEach((l, i) => {
        const ms = Math.round(l.start * 1000);
        parts.push(`[${i + 1}:a]adelay=${ms}|${ms},apad[v${i}]`);
    });
    parts.push(
        `${lines.map((_, i) => `[v${i}]`).join('')}amix=inputs=${lines.length}:normalize=0:dropout_transition=0,` +
            `volume=${VO_GAIN},atrim=0:${total},asetpts=N/SR/TB[vo]`
    );
    parts.push(`[vo]asplit=2[vo_mix][vo_key]`);

    // Bed: trimmed to length, faded at the tail, then ducked by the voice.
    parts.push(
        `[0:a]atrim=0:${total},asetpts=N/SR/TB,volume=${MUSIC_GAIN},` +
            `afade=t=in:st=0:d=1.5,afade=t=out:st=${(total - FADE_OUT).toFixed(3)}:d=${FADE_OUT}[bed]`
    );
    parts.push(
        `[bed][vo_key]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=350:makeup=1[duck]`
    );
    // Normalised to broadcast-ish loudness. The raw mix lands near -21 LUFS,
    // which is fine in isolation but noticeably quiet next to anything else a
    // viewer might have been watching.
    parts.push(
        `[duck][vo_mix]amix=inputs=2:normalize=0:dropout_transition=0,` +
            `loudnorm=I=-16:TP=-1.5:LRA=11[mix]`
    );

    await run('ffmpeg', [
        '-y',
        ...inputs,
        '-filter_complex', parts.join(';'),
        '-map', '[mix]',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '48000',
        '-ac', '2',
        outFile
    ]);
    return outFile;
}

// Runnable on its own for auditioning the audio without re-rendering video.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const manifest = JSON.parse(await readFile(path.join(outDir, 'timing.json'), 'utf8'));
    const out = path.join(outDir, 'soundtrack.m4a');
    await mixAudio(manifest.total, out);
    process.stdout.write(`${out}\n`);
}
