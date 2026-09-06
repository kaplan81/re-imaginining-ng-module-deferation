/**
 * Fails fast, and legibly, when a dev-server port is already taken.
 *
 * Without this, `npm run start:everything` on a machine that is already serving
 * one of the fifteen ports produces a wall of
 *
 *   Error: listen EADDRINUSE: address already in use ::1:4211
 *
 * from whichever applications lost the race — and because the fan-out scripts use
 * `concurrently -k`, the first one to exit takes the other fourteen down with it.
 * The visible result is "start:everything is broken", with the actual cause
 * scrolled off the top. One occupied port should not look like a broken script.
 *
 * Usage: node tools/check-ports.mjs <cli|rspack|vite|everything>
 */
import { createConnection } from 'node:net';
import { execFileSync } from 'node:child_process';

const pipelines = {
  cli: { label: 'build 1 (Angular CLI)', stop: 'npm run start:all', ports: { shell: 4200, catalog: 4201, orders: 4202, 'top-lots': 4203, 'roast-queue': 4204 } },
  rspack: { label: 'build 2 (Rspack)', stop: 'npm run start:rspack:all', ports: { shell: 4210, catalog: 4211, orders: 4212, 'top-lots': 4213, 'roast-queue': 4214 } },
  vite: { label: 'build 3 (Vite)', stop: 'npm run start:vite:all', ports: { shell: 5173, catalog: 5174, orders: 5175, 'top-lots': 5176, 'roast-queue': 5177 } },
};

const which = process.argv[2] ?? 'everything';
const selected = which === 'everything' ? Object.keys(pipelines) : [which];

if (selected.some((name) => !pipelines[name])) {
  console.error(`check-ports: unknown pipeline "${which}". Use cli, rspack, vite or everything.`);
  process.exit(2);
}

/**
 * A *connect* probe rather than a bind probe. Dev servers here bind `::1` as
 * well as `127.0.0.1`, and a bind test on one family happily succeeds while the
 * other is occupied - which is exactly the case that produced the EADDRINUSE
 * this check exists to pre-empt.
 */
function inUse(port, host) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(700);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

/** Best effort: name the process holding the port, so the fix is obvious. */
function holder(port) {
  try {
    const out = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const line = out.trim().split('\n')[1];
    if (!line) return null;
    const [command, pid] = line.split(/\s+/);
    return `${command} (pid ${pid})`;
  } catch {
    return null;
  }
}

const taken = [];

for (const name of selected) {
  const { label, stop, ports } = pipelines[name];

  for (const [app, port] of Object.entries(ports)) {
    if ((await inUse(port, '127.0.0.1')) || (await inUse(port, '::1'))) {
      taken.push({ label, stop, app, port, by: holder(port) });
    }
  }
}

if (taken.length === 0) {
  process.exit(0);
}

const pipelinesHit = [...new Set(taken.map((t) => t.stop))];

console.error(`\n  ${taken.length} of the ports this needs ${taken.length === 1 ? 'is' : 'are'} already in use:\n`);
for (const { label, app, port, by } of taken) {
  console.error(`    ${String(port).padEnd(6)} ${label} · ${app}${by ? `  — held by ${by}` : ''}`);
}
console.error(`\n  Most likely another dev stack is still running in a different terminal.`);
console.error(`  Stop it there with Ctrl-C${pipelinesHit.length === 1 ? ` (it was started by \`${pipelinesHit[0]}\`)` : ''}, then run this again.\n`);

process.exit(1);
