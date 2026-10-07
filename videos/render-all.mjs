#!/usr/bin/env node
// Render every scene in order and assemble the finished video.
//
// Every join is a plain cut, and the assembly is a stream copy — no re-encode,
// so the cut points are exactly as rendered.
//
// That works because each join is authored to be invisible on its own terms.
// Scenes 1→2 and 3→4 meet through black. Scene 2→3 is the interesting one: the
// camera pans off the users and onto the cloud at the end of scene 2, and scene
// 3 opens on that same pose with the same diagram, so the two frames either side
// of the cut are identical and the pan simply continues. Both scenes derive the
// pose from `focusCloud` in scene-kit for exactly that reason.

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { mixAudio } from './audio/mix.mjs';
import { SCENE_BARS, BAR } from './audio/script.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'out');

const SCENES = [
    '01-opening',
    '02-boundaries-outer',
    '03-boundaries-inner',
    '04-what-do-we-call-it',
    '05-the-promise'
];

function run(cmd, args, opts = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
        child.on('close', (code) =>
            code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))
        );
    });
}

function duration(file) {
    return new Promise((resolve, reject) => {
        const child = spawn('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'csv=p=0',
            file
        ]);
        let out = '';
        child.stdout.on('data', (d) => (out += d));
        child.on('close', (code) => {
            const n = Number(out.trim());
            if (code !== 0 || !Number.isFinite(n)) reject(new Error(`ffprobe failed on ${file}`));
            else resolve(n);
        });
    });
}

async function main() {
    await mkdir(outDir, { recursive: true });

    const parts = [];
    for (const scene of SCENES) {
        const dir = path.join(here, scene);
        const out = path.join(outDir, `${scene}.mp4`);
        process.stdout.write(`\n=== ${scene} ===\n`);
        await run('pnpm', ['exec', 'render-scene', '--out', out], { cwd: dir });
        parts.push(out);
    }

    const durations = await Promise.all(parts.map(duration));
    let elapsed = 0;
    const cuts = durations.slice(0, -1).map((d) => (elapsed += d).toFixed(1));

    const listFile = path.join(outDir, 'concat.txt');
    await writeFile(listFile, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n') + '\n');

    const silent = path.join(outDir, 'video-1-silent.mp4');
    process.stdout.write(`\n=== stitching (cuts at ${cuts.join('s, ')}s) ===\n`);
    await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', silent]);

    // --- Soundtrack --------------------------------------------------------
    //
    // Narration and music are cached by a hash of the request, so this is a
    // no-op unless the script or the music prompt changed. The mix is built to
    // the video's real duration rather than the script's nominal one, so a
    // retimed scene cannot silently desync the tail.

    process.stdout.write('\n=== narration + music ===\n');
    await run('node', [path.join(here, 'audio', 'generate.mjs')]);

    const videoDuration = await duration(silent);
    const scriptTotal = SCENE_BARS.reduce((m, s) => Math.max(m, s.start + s.length), 0) * BAR;
    if (Math.abs(videoDuration - scriptTotal) > 0.05) {
        process.stdout.write(
            `\nwarning: video is ${videoDuration.toFixed(2)}s but the narration grid assumes ` +
                `${scriptTotal.toFixed(2)}s. Update SCENE_BARS in audio/script.mjs — lines after the ` +
                `drift will land on the wrong beat.\n`
        );
    }

    process.stdout.write('\n=== mixing ===\n');
    const track = await mixAudio(videoDuration, path.join(outDir, 'soundtrack.m4a'));

    const final = path.join(outDir, 'video-1-what-is-private-data.mp4');
    await run('ffmpeg', [
        '-y',
        '-i', silent,
        '-i', track,
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        '-movflags', '+faststart',
        final
    ]);
    process.stdout.write(`\n${final}\n`);
}

main().catch((err) => {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
});
