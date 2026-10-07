#!/usr/bin/env node
// Frame-locked capture: drive a scene's seek() one frame at a time in headless
// Chromium and pipe PNGs straight into ffmpeg.
//
// Nothing here depends on wall-clock timing. The page never animates on its
// own during capture — every frame is explicitly requested — so the output is
// reproducible and a slow machine produces the same video as a fast one.

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { createServer } from 'vite';
import { chromium } from 'playwright';

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root ?? process.cwd());
const outDir = path.resolve(args.outDir ?? path.join(root, 'out'));

function parseArgs(argv) {
    const out = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith('--')) {
            const key = a.slice(2);
            const next = argv[i + 1];
            if (next === undefined || next.startsWith('--')) {
                out[key] = true;
            } else {
                out[key] = next;
                i++;
            }
        } else {
            out._.push(a);
        }
    }
    return out;
}

async function main() {
    await mkdir(outDir, { recursive: true });

    const server = await createServer({
        root,
        logLevel: 'error',
        server: { port: 0, strictPort: false, host: '127.0.0.1' },
        clearScreen: false
    });
    await server.listen();
    const { port } = server.httpServer.address();
    const url = `http://127.0.0.1:${port}/`;

    const browser = await chromium.launch({
        args: [
            '--force-color-profile=srgb',
            '--disable-lcd-text',
            '--hide-scrollbars',
            '--disable-gpu-vsync',
            '--font-render-hinting=none'
        ]
    });

    let exitCode = 0;
    try {
        const page = await browser.newPage({
            viewport: { width: 1920, height: 1080 },
            deviceScaleFactor: 1
        });

        const problems = [];
        page.on('pageerror', (e) => problems.push(String(e)));
        page.on('console', (m) => {
            if (m.type() === 'error') problems.push(m.text());
        });

        await page.goto(url, { waitUntil: 'load' });
        await page.waitForFunction('window.__sceneReady === true', null, { timeout: 30000 });
        await page.evaluate(() => document.fonts && document.fonts.ready);

        if (problems.length) {
            throw new Error(`Scene reported errors:\n  ${problems.join('\n  ')}`);
        }

        const meta = await page.evaluate(() => ({
            name: window.__scene.name,
            fps: window.__scene.fps,
            duration: window.__scene.duration,
            frames: window.__scene.frameCount()
        }));

        const fps = Number(args.fps ?? meta.fps);
        const totalFrames = args.fps ? Math.round(meta.duration * fps) : meta.frames;

        // --probe renders single frames to PNG for eyeballing without paying
        // for a full render. Accepts a comma-separated list of times in seconds.
        if (args.probe) {
            const times = String(args.probe)
                .split(',')
                .map((s) => Number(s.trim()))
                .filter((n) => Number.isFinite(n));
            for (const t of times) {
                await page.evaluate((tt) => window.__scene.seek(tt), t);
                const buf = await page.screenshot({ type: 'png' });
                const file = path.join(outDir, `probe-${meta.name}-${t.toFixed(2)}s.png`);
                await writeFile(file, buf);
                process.stdout.write(`probe ${t.toFixed(2)}s -> ${file}\n`);
            }
            return;
        }

        const outFile = path.resolve(args.out ?? path.join(outDir, `${meta.name}.mp4`));
        const ffmpeg = spawn(
            'ffmpeg',
            [
                '-y',
                '-f', 'image2pipe',
                '-framerate', String(fps),
                '-c:v', 'png',
                '-i', '-',
                '-c:v', 'libx264',
                '-profile:v', 'high',
                '-pix_fmt', 'yuv420p',
                '-crf', String(args.crf ?? 16),
                '-preset', String(args.preset ?? 'medium'),
                '-movflags', '+faststart',
                outFile
            ],
            { stdio: ['pipe', 'ignore', 'pipe'] }
        );

        let ffmpegErr = '';
        ffmpeg.stderr.on('data', (d) => {
            ffmpegErr += d.toString();
            if (ffmpegErr.length > 20000) ffmpegErr = ffmpegErr.slice(-20000);
        });
        const ffmpegDone = once(ffmpeg, 'close');

        const started = Date.now();
        process.stdout.write(
            `rendering ${meta.name}: ${totalFrames} frames @ ${fps}fps (${meta.duration.toFixed(2)}s) -> ${outFile}\n`
        );

        for (let i = 0; i < totalFrames; i++) {
            await page.evaluate(
                ([frame, rate]) => window.__scene.seek(frame / rate),
                [i, fps]
            );
            const buf = await page.screenshot({ type: 'png' });
            if (!ffmpeg.stdin.write(buf)) await once(ffmpeg.stdin, 'drain');

            if (i % 60 === 0 || i === totalFrames - 1) {
                const pct = (((i + 1) / totalFrames) * 100).toFixed(1);
                const elapsed = (Date.now() - started) / 1000;
                const rate = (i + 1) / elapsed;
                const eta = (totalFrames - i - 1) / (rate || 1);
                process.stdout.write(
                    `\r  ${pct}%  frame ${i + 1}/${totalFrames}  ${rate.toFixed(1)} fps  eta ${eta.toFixed(0)}s   `
                );
            }
        }
        process.stdout.write('\n');

        ffmpeg.stdin.end();
        const [code] = await ffmpegDone;
        if (code !== 0) {
            throw new Error(`ffmpeg exited ${code}\n${ffmpegErr}`);
        }

        if (problems.length) {
            process.stdout.write(`warning: scene logged ${problems.length} error(s) during capture\n`);
        }
        process.stdout.write(`done in ${((Date.now() - started) / 1000).toFixed(1)}s -> ${outFile}\n`);
    } catch (err) {
        process.stderr.write(`${err.stack ?? err}\n`);
        exitCode = 1;
    } finally {
        await browser.close();
        await server.close();
    }
    process.exit(exitCode);
}

main();
