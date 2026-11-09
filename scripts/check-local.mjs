import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const key = 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY';
const next = new URL('../node_modules/next/dist/bin/next', import.meta.url).pathname;
const root = new URL('../', import.meta.url);
const results = [];

function environment(value) {
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'production' };
  delete env[key];
  if (value !== undefined) env[key] = value;
  return env;
}

async function runBuild(value, index) {
  await rm(new URL('../.next', import.meta.url), { recursive: true, force: true });
  const child = spawn(process.execPath, [next, 'build'], { cwd: root, env: environment(value) });
  let log = '';
  child.stdout.on('data', chunk => { log += chunk; });
  child.stderr.on('data', chunk => { log += chunk; });
  const [code, signal] = await once(child, 'exit');
  await writeFile(new URL(`../results/build-${index}.log`, import.meta.url), log);
  assert.equal(code, 0, `Build ${index} failed (${signal ?? code}): ${log.slice(-5000)}`);
}

async function freePort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return port;
}

function readOutput(html, id) {
  const match = html.match(new RegExp(`<output id="${id}">([^<]*)</output>`));
  assert.ok(match, `Missing output element: ${id}`);
  return match[1];
}

async function inspect(buildValue, runtimeValue, index) {
  await runBuild(buildValue, index);
  const port = await freePort();
  const child = spawn(process.execPath, [next, 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: root,
    env: environment(runtimeValue),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  child.stdout.on('data', chunk => { serverLog += chunk; });
  child.stderr.on('data', chunk => { serverLog += chunk; });
  try {
    let response;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(`Server exited: ${serverLog}`);
      try { response = await fetch(`http://127.0.0.1:${port}`); break; }
      catch { await delay(100); }
    }
    assert.ok(response, `Server failed to start: ${serverLog}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    const expected = buildValue ?? 'UNSET';
    const serverReference = readOutput(html, 'server-probe');
    const clientReference = readOutput(html, 'env-probe');
    assert.equal(serverReference, expected);
    assert.equal(clientReference, expected);
    assert.equal(readOutput(html, 'probe-match'), 'MATCH');
    const result = { buildValue: expected, runtimeValue: runtimeValue ?? 'UNSET', serverReference, clientReference, outcome: 'PASS' };
    results.push(result);
    console.log(JSON.stringify(result));
  } finally {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    await exited;
  }
}

assert.equal(process.versions.node.split('.')[0], '22', 'Run this control with Node.js 22.');
await mkdir(new URL('../results', import.meta.url), { recursive: true });
await inspect('CONTROL_GENERAL_PREVIEW', 'CONTROL_BRANCH_PREVIEW', 1);
await inspect('CONTROL_BRANCH_PREVIEW', 'CONTROL_GENERAL_PREVIEW', 2);
await inspect(undefined, 'CONTROL_GENERAL_PREVIEW', 3);
await writeFile(new URL('../results/local-results.json', import.meta.url), JSON.stringify({ node: process.version, next: '15.5.24', results }, null, 2) + '\n');
