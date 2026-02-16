/**
 * Docker-based Code Execution (Judge) Service
 *
 * Polls for pending submissions, runs code in isolated containers,
 * and updates results. Designed to run as a separate worker process.
 *
 * Setup: Ensure Docker is running. Uses images per language:
 * - python:3.11-slim
 * - node:18-slim
 * - openjdk:11-slim
 * - gcc (for C++)
 */

import Docker from 'dockerode';

const docker = new Docker();

const LANGUAGE_IMAGES: Record<string, string> = {
  python: 'python:3.11-slim',
  javascript: 'node:18-slim',
  java: 'openjdk:11-slim',
  cpp: 'gcc:latest',
};

async function runInContainer(
  code: string,
  language: string,
  input: string,
  timeLimitMs: number = 5000,
  memoryLimitMb: number = 512
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const image = LANGUAGE_IMAGES[language] || LANGUAGE_IMAGES.python;

  let cmd: string[];
  let wrappedCode = code;

  switch (language) {
    case 'python':
      cmd = ['python', '-c', code];
      break;
    case 'javascript':
      cmd = ['node', '-e', code];
      break;
    case 'java':
      // Simplified: would need to write .java file and compile
      cmd = ['sh', '-c', 'echo "Java execution not fully implemented in this MVP"'];
      break;
    case 'cpp':
      cmd = ['sh', '-c', 'echo "C++ execution not fully implemented in this MVP"'];
      break;
    default:
      cmd = ['python', '-c', code];
  }

  try {
    const container = await docker.createContainer({
      Image: image,
      Cmd: cmd,
      HostConfig: {
        Memory: memoryLimitMb * 1024 * 1024,
        MemorySwap: memoryLimitMb * 1024 * 1024,
        NetworkMode: 'none',
        AutoRemove: true,
      },
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    });

    const timeout = setTimeout(() => {
      container.kill().catch(() => {});
    }, timeLimitMs);

    await container.start();

    const stream = await container.attach({ stream: true, stdout: true, stderr: true });
    let stdout = '';
    let stderr = '';

    stream.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    stream.on('err', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const exitCode = await new Promise<number>((resolve) => {
      container.wait((err, data) => {
        clearTimeout(timeout);
        resolve(data?.StatusCode ?? -1);
      });
    });

    return { stdout, stderr, exitCode };
  } catch (err) {
    return {
      stdout: '',
      stderr: err instanceof Error ? err.message : 'Execution failed',
      exitCode: -1,
    };
  }
}

// Poll loop placeholder - integrate with DB/queue in production
async function pollAndExecute() {
  console.log('[Judge] Service started. Poll for pending submissions (integrate with Prisma/Redis queue).');
  // In production: query Submission where status='pending', run code, update status/score
}

pollAndExecute().catch(console.error);

export { runInContainer };
