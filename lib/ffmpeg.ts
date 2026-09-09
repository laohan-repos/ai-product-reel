import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export type VideoClipInput = {
  bytes: Uint8Array;
  duration: number;
  mimeType: string;
};

type VideoMetadata = {
  duration: number;
  hasAudio: boolean;
};

function executablePaths() {
  const ffmpeg = process.env.FFMPEG_PATH?.trim() || 'ffmpeg';
  const ffprobe =
    process.env.FFPROBE_PATH?.trim() ||
    (ffmpeg.includes(path.sep)
      ? path.join(path.dirname(ffmpeg), 'ffprobe')
      : 'ffprobe');
  return { ffmpeg, ffprobe };
}

function runCommand(command: string, args: string[]) {
  return new Promise<{ stderr: string; stdout: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const append = (parts: Buffer[], chunk: Buffer) => {
      parts.push(chunk);
      while (parts.reduce((total, part) => total + part.length, 0) > 1024 * 1024)
        parts.shift();
    };
    child.stdout.on('data', (chunk: Buffer) => append(stdout, chunk));
    child.stderr.on('data', (chunk: Buffer) => append(stderr, chunk));
    child.on('error', (error) => {
      if ('code' in error && error.code === 'ENOENT')
        reject(new Error(`找不到 ${command}，请在服务器安装 FFmpeg`));
      else reject(error);
    });
    child.on('close', (code) => {
      const output = {
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      };
      if (code === 0) resolve(output);
      else
        reject(
          new Error(
            output.stderr.trim() || `${path.basename(command)} 执行失败 (${code})`,
          ),
        );
    });
  });
}

async function probeVideo(
  filePath: string,
  fallbackDuration: number,
): Promise<VideoMetadata> {
  const { ffprobe } = executablePaths();
  const { stdout } = await runCommand(ffprobe, [
    '-v',
    'error',
    '-show_entries',
    'format=duration:stream=codec_type',
    '-of',
    'json',
    filePath,
  ]);
  const metadata = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{ codec_type?: string }>;
  };
  const detectedDuration = Number(metadata.format?.duration);
  return {
    duration:
      Number.isFinite(detectedDuration) && detectedDuration > 0
        ? detectedDuration
        : fallbackDuration,
    hasAudio:
      metadata.streams?.some((stream) => stream.codec_type === 'audio') ?? false,
  };
}

function extensionFor(mimeType: string) {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('quicktime')) return 'mov';
  if (mimeType.includes('matroska')) return 'mkv';
  return 'mp4';
}

export async function probeMediaDuration(
  bytes: Uint8Array,
  mimeType: string,
  fallbackDuration: number,
) {
  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), 'ai-product-reel-probe-'),
  );
  try {
    const filePath = path.join(
      temporaryDirectory,
      `media.${extensionFor(mimeType)}`,
    );
    await writeFile(filePath, bytes);
    return (await probeVideo(filePath, fallbackDuration)).duration;
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}

export async function composeVideoClips(clips: VideoClipInput[]) {
  if (clips.length === 0) throw new Error('没有可合成的分镜视频');
  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), 'ai-product-reel-'),
  );
  try {
    const inputPaths = await Promise.all(
      clips.map(async (clip, index) => {
        const filePath = path.join(
          temporaryDirectory,
          `clip-${index}.${extensionFor(clip.mimeType)}`,
        );
        await writeFile(filePath, clip.bytes);
        return filePath;
      }),
    );
    const metadata = await Promise.all(
      inputPaths.map((filePath, index) =>
        probeVideo(filePath, clips[index].duration),
      ),
    );

    const args = ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y'];
    for (const inputPath of inputPaths) args.push('-i', inputPath);

    const audioInputIndexes = new Map<number, number>();
    let nextInputIndex = inputPaths.length;
    metadata.forEach((item, index) => {
      if (item.hasAudio) return;
      audioInputIndexes.set(index, nextInputIndex);
      nextInputIndex += 1;
      args.push(
        '-f',
        'lavfi',
        '-t',
        item.duration.toFixed(6),
        '-i',
        'anullsrc=channel_layout=stereo:sample_rate=48000',
      );
    });

    const filters: string[] = [];
    const concatInputs: string[] = [];
    metadata.forEach((item, index) => {
      const duration = item.duration.toFixed(6);
      filters.push(
        `[${index}:v:0]scale=540:960:force_original_aspect_ratio=decrease,pad=540:960:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,format=yuv420p,trim=duration=${duration},setpts=PTS-STARTPTS[v${index}]`,
      );
      if (item.hasAudio)
        filters.push(
          `[${index}:a:0]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=duration=${duration},asetpts=PTS-STARTPTS[a${index}]`,
        );
      else
        filters.push(
          `[${audioInputIndexes.get(index)}:a:0]atrim=duration=${duration},asetpts=PTS-STARTPTS[a${index}]`,
        );
      concatInputs.push(`[v${index}][a${index}]`);
    });
    filters.push(
      `${concatInputs.join('')}concat=n=${clips.length}:v=1:a=1[vout][aout]`,
    );

    const outputPath = path.join(temporaryDirectory, 'final-product-video.mp4');
    args.push(
      '-filter_complex',
      filters.join(';'),
      '-map',
      '[vout]',
      '-map',
      '[aout]',
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '20',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
      outputPath,
    );
    await runCommand(executablePaths().ffmpeg, args);
    const output = await readFile(outputPath);
    if (output.length === 0) throw new Error('FFmpeg 输出视频为空');
    return Uint8Array.from(output);
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}
