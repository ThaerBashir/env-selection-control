import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const root = new URL('../', import.meta.url);
const next = new URL('../node_modules/next/dist/bin/next', import.meta.url).pathname;
const keyName = 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY';
const results = [];
const dummyKey = marker => `pk_test_${Buffer.from(`env-control-${marker.toLowerCase()}.invalid$`).toString('base64')}`;

function environment(marker) {
  const env = { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' };
  for (const name of Object.keys(env)) {
    if (name.startsWith('CLERK_') || name.startsWith('NEXT_PUBLIC_CLERK_')) delete env[name];
  }
  delete env.E2E_AUTH_BYPASS;
  env[keyName] = dummyKey(marker);
  env.CLERK_SECRET_KEY = 'sk_test_SYNTHETIC_ONLY_NEVER_VALID_00000000';
  return env;
}

async function freePort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return port;
}

async function build(marker) {
  await rm(new URL('../.next', import.meta.url), { recursive: true, force: true });
  const child = spawn(process.execPath, [next, 'build'], { cwd: root, env: environment(marker) });
  let log = '';
  child.stdout.on('data', chunk => { log += chunk; });
  child.stderr.on('data', chunk => { log += chunk; });
  const [code] = await once(child, 'exit');
  await writeFile(new URL(`../results/clerk-build-${marker.toLowerCase()}.log`, import.meta.url), log);
  assert.equal(code, 0, `Build failed: ${log.slice(-5000)}`);
  return log.includes('ƒ /');
}

function output(html, id) {
  const match = html.match(new RegExp(`<output id="${id}">([^<]*)</output>`));
  assert.ok(match, `Missing output: ${id}`);
  return match[1];
}

async function inspect(buildMarker, runtimeMarker) {
  const dynamicRoute = await build(buildMarker);
  assert.equal(dynamicRoute, true, 'Expected a dynamic homepage from ClerkProvider dynamic.');
  const port = await freePort();
  const child = spawn(process.execPath, [next, 'start', '--hostname', 'localhost', '--port', String(port)], {
    cwd: root,
    env: environment(runtimeMarker),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', chunk => { log += chunk; });
  child.stderr.on('data', chunk => { log += chunk; });
  try {
    let response;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(`Server exited: ${log}`);
      try {
        response = await fetch(`http://localhost:${port}/`, {
          headers: { Accept: '*/*' },
          redirect: 'manual',
          signal: AbortSignal.timeout(15000),
        });
        break;
      } catch { await delay(100); }
    }
    assert.ok(response, 'Local production server did not start.');
    assert.equal(response.status, 200, `Anonymous non-document request failed: ${log}`);
    const html = await response.text();
    const scripts = [...html.matchAll(/<script\b[^>]*\bdata-clerk-publishable-key="([^"]+)"[^>]*>/g)];
    assert.equal(scripts.length, 1, 'Expected exactly one Clerk script key attribute.');
    const expected = dummyKey(buildMarker);
    assert.equal(scripts[0][1], expected, 'Clerk HTML key differs from build input.');
    assert.equal(output(html, 'server-probe'), expected);
    assert.equal(output(html, 'env-probe'), expected);
    assert.equal(output(html, 'probe-match'), 'MATCH');

    const documentResponse = await fetch(`http://localhost:${port}/`, {
      headers: {
        Accept: 'text/html',
        'Sec-Fetch-Dest': 'document',
        Cookie: '__clerk_db_jwt=synthetic-dev-browser-marker',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(documentResponse.status, 200, `Synthetic signed-out document request failed: ${log}`);
    const documentHtml = await documentResponse.text();
    const documentScripts = [...documentHtml.matchAll(/<script\b[^>]*\bdata-clerk-publishable-key="([^"]+)"[^>]*>/g)];
    assert.equal(documentScripts.length, 1);
    assert.equal(documentScripts[0][1], expected);
    assert.equal(output(documentHtml, 'server-probe'), expected);
    assert.equal(output(documentHtml, 'env-probe'), expected);

    const documentWithoutCookie = await fetch(`http://localhost:${port}/`, {
      headers: { Accept: 'text/html', 'Sec-Fetch-Dest': 'document' },
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    assert.ok([302, 303, 307, 308].includes(documentWithoutCookie.status), 'Expected dummy test-key handshake redirect.');
    const location = new URL(documentWithoutCookie.headers.get('location'));
    assert.ok(location.hostname.endsWith('.invalid'), 'Unexpected handshake destination.');

    const result = {
      buildMarker,
      runtimeMarker,
      dynamicRoute,
      originalResponseStatus: response.status,
      clerkAttributeCount: scripts.length,
      clerkAttributeMatchesBuildInput: true,
      directServerAndClientReferencesMatchBuildInput: true,
      documentWithSyntheticCookieStatus: documentResponse.status,
      documentClerkAttributeMatchesBuildInput: true,
      documentWithoutCookieStatus: documentWithoutCookie.status,
      documentWithoutCookieRedirectToSyntheticInvalidHost: true,
      browserClerkLoaded: 'NOT_TESTED_WITH_DUMMY_CONFIGURATION',
      outcome: 'PASS',
    };
    results.push(result);
    console.log(JSON.stringify(result));
  } finally {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    await exited;
    await writeFile(new URL(`../results/clerk-server-${buildMarker.toLowerCase()}.log`, import.meta.url), log);
  }
}

assert.equal(process.versions.node.split('.')[0], '22', 'Run with Node.js 22.');
assert.equal(JSON.parse(await readFile(new URL('../package.json', import.meta.url))).name, 'env-selection-control');
await mkdir(new URL('../results', import.meta.url), { recursive: true });
await inspect('GENERAL', 'BRANCH');
await inspect('BRANCH', 'GENERAL');
await writeFile(new URL('../results/clerk-local-results.json', import.meta.url), JSON.stringify({
  node: process.version,
  next: '15.5.24',
  clerk: '6.39.6',
  results,
}, null, 2) + '\n');
