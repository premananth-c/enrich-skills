/**
 * Judge Service Entry Point
 *
 * Starts the BullMQ worker for async submission evaluation
 * and an HTTP server for synchronous run-code (sample test cases).
 *
 * Docker images used:
 * - python:3.12-slim
 * - node:20-slim
 * - eclipse-temurin:21-jdk
 * - gcc:13  (C / C++)
 */

import 'dotenv/config';
import './worker.js';
import http from 'http';
import { runCode, type RunResult } from './runner.js';

const PORT = parseInt(process.env.JUDGE_PORT || '4000', 10);

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/run') {
    let body = '';
    for await (const chunk of req) body += chunk;

    try {
      const { code, language, input, timeLimitMs, memoryLimitMb } = JSON.parse(body);
      if (!code || !language) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'code and language are required' }));
        return;
      }
      const result: RunResult = await runCode(
        code,
        language,
        input ?? '',
        timeLimitMs ?? 5000,
        memoryLimitMb ?? 256,
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }));
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`[Judge] HTTP server listening on port ${PORT}`);
});

export { runCode } from './runner.js';
