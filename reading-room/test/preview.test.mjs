import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { get } from 'node:http';

test('loopback preview rejects foreign Host headers', {timeout: 15000}, async () => {
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('../', import.meta.url),
    env: {...process.env, PORT:'0', LOCAL_PREVIEW:'1', OPDS_USERNAME:'reader', OPDS_PASSWORD:'test-only-password'},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const port = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', code => reject(new Error(`Preview exited: ${code}`)));
      child.stdout.on('data', data => {
        const match = String(data).match(/port (\d+)/);
        if (match) resolve(Number(match[1]));
      });
    });
    const url = `http://127.0.0.1:${port}/`;
    assert.equal((await fetch(url,{headers:{Authorization:'Basic '+btoa('reader:test-only-password')}})).status, 200);
    const status = await new Promise((resolve, reject) => {
      get(url, {headers:{Host:'attacker.example'}}, response => {
        response.resume(); resolve(response.statusCode);
      }).on('error', reject);
    });
    assert.equal(status, 403);
  } finally {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
});
