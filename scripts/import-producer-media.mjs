#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';

const ROOT = process.cwd();
const PRODUCER_JSON_PATH = path.join(ROOT, 'src/data/producer.json');
const VIDEO_OUT_DIR = path.join(ROOT, 'public/video');
const AUDIO_OUT_DIR = path.join(ROOT, 'public/audio');
const POSTER_OUT_DIR = path.join(ROOT, 'public/images/ideas');

const VIDEO_EXTS = new Set(['.mov', '.mp4', '.m4v']);
const AUDIO_EXTS = new Set(['.mp3', '.m4a', '.wav', '.aac']);

function printHelp() {
  console.log(`
Ro Halfhide - Producer Song Ideas Batch Importer

Usage:
  npm run import:producer -- <folder-path> [options]

Options:
  --chapter=<id>       Target chapter ID in src/data/producer.json (default: first chapter)
  --preset=<name>      macOS avconvert preset (default: Preset640x480; also Preset960x540, Preset1280x720)
  --audio-only         Extract MP3 audio tracks from video clips instead of keeping video
  --no-ffmpeg          Skip downloading ffmpeg-static and use macOS built-in afinfo/avconvert only
  --publish            Set draft: false on imported entries (default: draft: true)
  --help               Show this help message
`);
}

function slugify(name) {
  return name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `idea-${Date.now()}`;
}

function titleFromFilename(name) {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

async function collectFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectFiles(full)));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (VIDEO_EXTS.has(ext) || AUDIO_EXTS.has(ext)) results.push(full);
    }
  }
  return results.sort();
}

function resolveFfmpeg() {
  try {
    const sysPath = execSync('command -v ffmpeg', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (sysPath) return sysPath;
  } catch {
    // Fall back to /tmp/ff_tool
  }
  const localBin = '/private/tmp/ff_tool/node_modules/ffmpeg-static/ffmpeg';
  return localBin;
}

async function ensureFfmpeg(skipDownload = false) {
  const bin = resolveFfmpeg();
  try {
    await fs.access(bin);
    return bin;
  } catch {
    if (skipDownload) return null;
    try {
      await fs.mkdir('/tmp/ff_tool', { recursive: true });
      console.log('Installing temporary ffmpeg-static in /tmp/ff_tool for poster & duration extraction...');
      execSync('npm init -y && npm i --silent ffmpeg-static', {
        cwd: '/tmp/ff_tool',
        stdio: 'ignore',
        timeout: 15000,
      });
      await fs.access(bin);
      return bin;
    } catch {
      console.warn('ffmpeg unavailable; using macOS afinfo duration fallback and default poster.');
      return null;
    }
  }
}

function probeDurationWithAfinfo(filePath) {
  try {
    const out = execFileSync('/usr/bin/afinfo', [filePath], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    const match = out.match(/estimated duration:\s*([\d.]+)\s*sec/i);
    if (match) {
      const totalSec = Math.round(Number(match[1]));
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      return `${m}:${String(s).padStart(2, '0')}`;
    }
  } catch {
    // Fallback below
  }
  return '0:30';
}

function probeMediaWithFfmpeg(ffmpegBin, filePath) {
  if (!ffmpegBin) return { duration: probeDurationWithAfinfo(filePath), width: 360, height: 640 };
  try {
    execFileSync(ffmpegBin, ['-i', filePath], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    const stderr = String(err.stderr || '');
    const durMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    const dimMatch = stderr.match(/Video:.*?,\s*(\d{2,5})x(\d{2,5})/);
    let duration = '0:30';
    if (durMatch) {
      const totalSec = Math.round(Number(durMatch[1]) * 3600 + Number(durMatch[2]) * 60 + Number(durMatch[3]));
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      duration = `${m}:${String(s).padStart(2, '0')}`;
    }
    const width = dimMatch ? Number(dimMatch[1]) : 360;
    const height = dimMatch ? Number(dimMatch[2]) : 640;
    return { duration, width, height };
  }
  return { duration: '0:30', width: 360, height: 640 };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.length === 0) {
    printHelp();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const inputDirArg = args.find((a) => !a.startsWith('--'));
  if (!inputDirArg) {
    printHelp();
    process.exit(1);
  }

  const inputDir = path.resolve(inputDirArg);
  const chapterArg = args.find((a) => a.startsWith('--chapter='))?.split('=')[1];
  const preset = args.find((a) => a.startsWith('--preset='))?.split('=')[1] || 'Preset640x480';
  const audioOnly = args.includes('--audio-only');
  const skipFfmpeg = args.includes('--no-ffmpeg');
  const publish = args.includes('--publish');

  const files = await collectFiles(inputDir);
  if (files.length === 0) {
    console.log(`No .mov, .mp4, .mp3, .m4a, or .wav files found in ${inputDir}`);
    return;
  }

  const rawJson = await fs.readFile(PRODUCER_JSON_PATH, 'utf8');
  const catalog = JSON.parse(rawJson);
  const targetChapterId = chapterArg || catalog.chapters?.[0]?.id || 'chapter-acoustic-soul';

  await fs.mkdir(VIDEO_OUT_DIR, { recursive: true });
  await fs.mkdir(AUDIO_OUT_DIR, { recursive: true });
  await fs.mkdir(POSTER_OUT_DIR, { recursive: true });

  const ffmpegBin = await ensureFfmpeg(skipFfmpeg);
  const existingSrcs = new Set((catalog.songIdeas || []).map((i) => i.src));
  let addedCount = 0;

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    const baseName = path.basename(filePath);
    const slug = slugify(baseName);
    const title = titleFromFilename(baseName);

    if (VIDEO_EXTS.has(ext) && !audioOnly) {
      const outMp4 = path.join(VIDEO_OUT_DIR, `${slug}.mp4`);
      const outPoster = path.join(POSTER_OUT_DIR, `${slug}-poster.jpg`);
      const publicSrc = `/video/${slug}.mp4`;
      const publicPoster = `/images/ideas/${slug}-poster.jpg`;

      console.log(`Converting video: ${baseName} -> ${publicSrc} (${preset})`);
      execFileSync('/usr/bin/avconvert', ['--source', filePath, '--preset', preset, '--output', outMp4, '--replace'], {
        stdio: 'inherit',
      });

      const meta = probeMediaWithFfmpeg(ffmpegBin, outMp4);
      let posterUrl = '/images/hero-portrait.jpg';
      if (ffmpegBin) {
        try {
          execFileSync(ffmpegBin, ['-ss', '00:00:00.200', '-i', outMp4, '-vframes', '1', '-q:v', '2', outPoster, '-y'], {
            stdio: 'ignore',
          });
          await fs.access(outPoster);
          posterUrl = publicPoster;
        } catch {
          try {
            execFileSync(ffmpegBin, ['-i', outMp4, '-vframes', '1', '-q:v', '2', outPoster, '-y'], {
              stdio: 'ignore',
            });
            await fs.access(outPoster);
            posterUrl = publicPoster;
          } catch {
            // Fallback to default image if frame extraction fails
          }
        }
      }

      if (!existingSrcs.has(publicSrc)) {
        const ratio = meta.width / meta.height;
        const aspectRatio = ratio > 1.2 ? '16:9' : ratio < 0.85 ? '9:16' : '1:1';
        catalog.songIdeas.push({
          id: `idea-${slug}-${Date.now()}`,
          chapterId: targetChapterId,
          title,
          mediaType: 'video',
          src: publicSrc,
          poster: posterUrl,
          cover: posterUrl,
          duration: meta.duration,
          note: 'Imported from Instagram Song Ideas archive.',
          year: String(new Date().getFullYear()),
          aspectRatio,
          width: meta.width,
          height: meta.height,
          instagramUrl: catalog.instagramHighlightsUrl,
          draft: !publish,
        });
        existingSrcs.add(publicSrc);
        addedCount++;
      }
    } else {
      const outMp3 = path.join(AUDIO_OUT_DIR, `${slug}.mp3`);
      const publicSrc = `/audio/${slug}.mp3`;

      if (ext === '.mp3') {
        if (path.resolve(filePath) !== path.resolve(outMp3)) {
          await fs.copyFile(filePath, outMp3);
        }
      } else if (ffmpegBin) {
        console.log(`Extracting/converting audio: ${baseName} -> ${publicSrc}`);
        execFileSync(ffmpegBin, ['-i', filePath, '-vn', '-codec:a', 'libmp3lame', '-q:a', '2', outMp3, '-y'], {
          stdio: 'ignore',
        });
      } else {
        console.warn(`Skipping ${baseName}: ffmpeg unavailable to convert ${ext} to .mp3`);
        continue;
      }

      const meta = probeMediaWithFfmpeg(ffmpegBin, outMp3);
      if (!existingSrcs.has(publicSrc)) {
        catalog.songIdeas.push({
          id: `idea-${slug}-${Date.now()}`,
          chapterId: targetChapterId,
          title,
          mediaType: 'audio',
          src: publicSrc,
          cover: '/images/hero-portrait.jpg',
          duration: meta.duration,
          note: 'Imported studio sketch.',
          year: String(new Date().getFullYear()),
          instagramUrl: catalog.instagramHighlightsUrl,
          draft: !publish,
        });
        existingSrcs.add(publicSrc);
        addedCount++;
      }
    }
  }

  await fs.writeFile(PRODUCER_JSON_PATH, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  console.log(`\nDone. Added ${addedCount} new entries to src/data/producer.json (chapter: ${targetChapterId}, draft: ${!publish}).`);
}

main().catch((err) => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
