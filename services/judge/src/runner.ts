import Docker from 'dockerode';
import { Writable } from 'stream';

const docker = new Docker();

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  timedOut: boolean;
}

const LANGUAGE_CONFIG: Record<string, {
  image: string;
  buildCmd?: (filename: string) => string[];
  runCmd: (filename: string) => string[];
  filename: string;
}> = {
  python: {
    image: 'python:3.12-slim',
    runCmd: (f) => ['python', f],
    filename: 'solution.py',
  },
  javascript: {
    image: 'node:20-slim',
    runCmd: (f) => ['node', f],
    filename: 'solution.js',
  },
  typescript: {
    image: 'node:20-slim',
    runCmd: (f) => ['npx', '--yes', 'tsx', f],
    filename: 'solution.ts',
  },
  java: {
    image: 'eclipse-temurin:21-jdk',
    buildCmd: (f) => ['javac', f],
    runCmd: () => ['java', 'Main'],
    filename: 'Main.java',
  },
  cpp: {
    image: 'gcc:13',
    buildCmd: (f) => ['g++', '-std=c++17', '-O2', '-o', '/tmp/a.out', f],
    runCmd: () => ['/tmp/a.out'],
    filename: 'solution.cpp',
  },
  c: {
    image: 'gcc:13',
    buildCmd: (f) => ['gcc', '-std=c17', '-O2', '-o', '/tmp/a.out', f],
    runCmd: () => ['/tmp/a.out'],
    filename: 'solution.c',
  },
};

async function collectStream(container: Docker.Container): Promise<{ stdout: string; stderr: string }> {
  const stream = await container.attach({ stream: true, stdout: true, stderr: true });
  let stdout = '';
  let stderr = '';

  const stdoutWriter = new Writable({
    write(chunk, _enc, cb) { stdout += chunk.toString(); cb(); },
  });
  const stderrWriter = new Writable({
    write(chunk, _enc, cb) { stderr += chunk.toString(); cb(); },
  });

  docker.modem.demuxStream(stream, stdoutWriter, stderrWriter);

  return new Promise((resolve) => {
    stream.on('end', () => resolve({ stdout, stderr }));
    stream.on('error', () => resolve({ stdout, stderr }));
  });
}

export async function runCode(
  code: string,
  language: string,
  input: string,
  timeLimitMs: number = 5000,
  memoryLimitMb: number = 256,
): Promise<RunResult> {
  const config = LANGUAGE_CONFIG[language];
  if (!config) {
    return { stdout: '', stderr: `Unsupported language: ${language}`, exitCode: -1, executionTimeMs: 0, timedOut: false };
  }

  const filePath = `/tmp/${config.filename}`;

  const buildStep = config.buildCmd
    ? `echo '${escapeShell(code)}' > ${filePath} && ${config.buildCmd(filePath).join(' ')} && `
    : `echo '${escapeShell(code)}' > ${filePath} && `;

  const runStep = config.runCmd(filePath).join(' ');
  const fullCmd = ['sh', '-c', `${buildStep}echo '${escapeShell(input)}' | ${runStep}`];

  let container: Docker.Container | null = null;
  let timedOut = false;

  try {
    container = await docker.createContainer({
      Image: config.image,
      Cmd: fullCmd,
      HostConfig: {
        Memory: memoryLimitMb * 1024 * 1024,
        MemorySwap: memoryLimitMb * 1024 * 1024,
        NetworkMode: 'none',
        ReadonlyRootfs: false,
        SecurityOpt: ['no-new-privileges'],
      },
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      User: '1000:1000',
    });

    const streamPromise = collectStream(container);

    const startTime = Date.now();
    await container.start();

    const timeoutHandle = setTimeout(async () => {
      timedOut = true;
      try { await container!.kill(); } catch { /* already stopped */ }
    }, timeLimitMs);

    const waitResult = await container.wait();
    clearTimeout(timeoutHandle);

    const elapsed = Date.now() - startTime;
    const { stdout, stderr } = await streamPromise;

    return {
      stdout: stdout.slice(0, 1024 * 100),
      stderr: stderr.slice(0, 1024 * 50),
      exitCode: waitResult.StatusCode,
      executionTimeMs: elapsed,
      timedOut,
    };
  } catch (err) {
    return {
      stdout: '',
      stderr: err instanceof Error ? err.message : 'Execution failed',
      exitCode: -1,
      executionTimeMs: 0,
      timedOut: false,
    };
  } finally {
    if (container) {
      try { await container.remove({ force: true }); } catch { /* cleanup best-effort */ }
    }
  }
}

function escapeShell(s: string): string {
  return s.replace(/'/g, "'\\''");
}
