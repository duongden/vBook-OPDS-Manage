// Inspect the Git index, never print a matched secret or file contents.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '-z'], {encoding:'utf8'}).split('\0').filter(Boolean);
const forbidden = /(^|\/)(node_modules|\.wrangler|\.openai|dist)(\/|$)|(^|\/)wrangler\.production\.toml$|(^|\/)\.(env|dev\.vars)(?!\.example$)(\.|$)|\.(pem|key|p12|sqlite3?|db|apk|dex)$/i;
const patterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
  ['GitHub token', /(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
];
const localValues = [];
for (const path of ['.dev.vars', '.env']) {
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^\s*(GOOGLE_API_KEY|MASK_SECRET|AUTH_PASS|AUTH_TOKEN)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if (/^["']/.test(value)) value = value.slice(1, value.lastIndexOf(value[0]));
    else value = value.replace(/\s+#.*$/, '');
    if (value.length >= 12 && !/^(replace-with-|your-|AIzaSyYour)/.test(value)) localValues.push(value);
  }
}
let failures = 0;
for (const path of files) {
  if (forbidden.test(path)) { console.error(`Forbidden indexed file: ${path}`); failures++; continue; }
  const content = execFileSync('git', ['show', `:${path}`], {encoding:'utf8', maxBuffer:32*1024*1024});
  for (const [label, pattern] of patterns) {
    if (pattern.test(content)) { console.error(`Potential ${label}: ${path}`); failures++; }
  }
  if (localValues.some(value => content.includes(value))) {
    console.error(`Local secret value present: ${path}`); failures++;
  }
  if (/wrangler(?:\.production)?\.toml(?:\.example)?$/.test(path)) {
    const id = content.match(/database_id\s*=\s*"([^"]+)"/)?.[1];
    if (id && id !== '00000000-0000-0000-0000-000000000001' && id !== 'replace-with-your-d1-database-id') {
      console.error(`Production D1 identifier present: ${path}`); failures++;
    }
  }
}
if (failures) process.exitCode = 1;
else console.log(`PASS: ${files.length} indexed files scanned; no forbidden files or matching credential patterns/local values.`);
