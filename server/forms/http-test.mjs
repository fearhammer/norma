// Run: node server/forms/http-test.mjs /absolute/path/to/php
// Uses a loopback SMTP sink; nothing is sent to the real mailbox.
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const temp = await mkdtemp(join(tmpdir(), 'norma-forms-'));
const mails = [];
const smtp = createServer(socket => {
  socket.write('220 localhost test SMTP\r\n');
  let buffer = '', data = false, message = '';
  socket.on('data', chunk => {
    buffer += chunk;
    let end;
    while ((end = buffer.indexOf('\r\n')) !== -1) {
      const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
      if (data && line !== '.') { message += line + '\r\n'; continue; }
      if (data) { mails.push(message); data = false; message = ''; socket.write('250 accepted\r\n'); }
      else if (line === 'DATA') { data = true; socket.write('354 send data\r\n'); }
      else if (line === 'QUIT') socket.end('221 bye\r\n');
      else socket.write('250 OK\r\n');
    }
  });
});
await new Promise(resolve => smtp.listen(0, '127.0.0.1', resolve));
const reserve = createServer();
await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
const port = reserve.address().port;
await new Promise(resolve => reserve.close(resolve));
const origin = 'https://fearhammer.github.io';
const phpQuote = text => "'" + text.replaceAll('\\', '\\\\').replaceAll("'", "\\'") + "'";
const config = join(temp, 'config.php');
await writeFile(config, `<?php return ['secret'=>'${randomBytes(32).toString('hex')}', 'state_file'=>${phpQuote(join(temp, 'state.json'))}, 'origins'=>['${origin}']];`);
const php = spawn(process.argv[2] || 'php', ['-d', 'SMTP=127.0.0.1', '-d', `smtp_port=${smtp.address().port}`, '-S', `127.0.0.1:${port}`, '-t', root], { env: { ...process.env, NORMA_FORMS_CONFIG: config }, windowsHide: true, stdio: 'pipe' });
let phpError = null;
php.on('error', error => { phpError = error; });
php.stderr.resume(); php.stdout.resume();
const url = `http://127.0.0.1:${port}/`;
const call = (method, body, extra = {}) => fetch(url, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    if (phpError) throw phpError;
    try { await call('OPTIONS'); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert.ok(ready, 'PHP server starts');
  const options = await call('OPTIONS');
  assert.equal(options.status, 204);
  assert.equal(options.headers.get('access-control-allow-origin'), origin);
  const forbidden = await call('GET', undefined, { Origin: 'https://evil.example' });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.headers.get('access-control-allow-origin'), null);
  assert.equal((await call('PUT')).status, 405);
  const challenge = await (await call('GET')).json();
  const input = { name: 'Проверка локального обработчика', email: 'test@example.com', telegram: '@test', website: 'example.com', service: 'Тест', page: `${origin}/norma/`, company_fax: '', token: challenge.token };
  assert.equal((await call('POST', input)).status, 429);
  await new Promise(resolve => setTimeout(resolve, 3200));
  const sent = await call('POST', input);
  assert.equal(sent.status, 200);
  assert.equal((await sent.json()).ok, true);
  assert.equal(mails.length, 1);
  assert.match(mails[0], /To: mail@norma-studio.ru/);
  const encoded = mails[0].match(/Subject: =\?UTF-8\?B\?(.+?)\?=/)[1];
  assert.equal(Buffer.from(encoded, 'base64').toString(), 'Заявка с сайта Norma');
  const content = Buffer.from(mails[0].split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\s/g, ''), 'base64').toString();
  for (const key of ['name', 'email', 'telegram', 'website', 'service', 'page']) assert.ok(content.includes(input[key]), key);
  assert.equal((await call('POST', input)).status, 200);
  assert.equal(mails.length, 1, 'retry does not resend');
  assert.equal((await call('POST', { ...input, company_fax: 'bot' })).status, 422);
  assert.equal((await call('POST', { ...input, token: 'fake' })).status, 403);
  assert.equal((await call('POST', { ...input, email: 'test@example.com\r\nBcc: evil@example.com' })).status, 422);
  assert.equal((await call('POST', { ...input, name: 'x'.repeat(9000) })).status, 413);
  assert.equal((await call('POST', input, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal(mails.length, 1);
  console.log('PASS: HTTP, CORS, validation, spam guards, duplicate retry and local SMTP delivery; no real email sent.');
} finally {
  php.kill();
  await new Promise(resolve => php.exitCode !== null ? resolve() : php.once('exit', resolve));
  await new Promise(resolve => smtp.close(resolve));
  await rm(temp, { recursive: true, force: true });
}
