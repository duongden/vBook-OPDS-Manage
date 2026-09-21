import { HTTPException } from 'hono/http-exception';

const enc = new TextEncoder();
export const fail = (status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500 | 503, message: string): never => {
  throw new HTTPException(status, { message });
};
export function base64url(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, n => String.fromCharCode(n)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decode(value: string): Uint8Array {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}
export const randomToken = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value))));
}
export function equal(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
// PBKDF2 is supported by Workers Web Crypto. Benchmark deployment CPU separately.
const ITERATIONS = 100_000;
export async function hashPassword(password: string, salt = randomToken(), pepper?: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: ITERATIONS }, key, 256);
  const hash = base64url(new Uint8Array(bits));
  // Server-side HMAC pepper protects a D1-only leak despite workerd's 100k PBKDF2 cap.
  return pepper ? `p1.${salt}.${await bookKey(pepper, 'password-pepper', hash)}` : `${salt}.${hash}`;
}
export async function checkPassword(password: string, stored: string, pepper?: string): Promise<boolean> {
  const parts = stored.split('.');
  if (parts[0] === 'p1') {
    if (!pepper) return false;
    return equal(await hashPassword(password, parts[1], pepper), stored);
  }
  // Existing local libraries are rehashed with the server pepper after valid login.
  return equal(await hashPassword(password, parts[0]), stored);
}
export function passwordInput(value: unknown): string {
  if (typeof value !== 'string' || value.length < 12 || value.length > 256) fail(400, 'Mật khẩu cần từ 12 đến 256 ký tự.');
  return value as string;
}
export function stringInput(value: unknown, max: number, label: string, required = false): string {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail(400, `${label} không hợp lệ.`);
  const result = (value as string).trim();
  if (required && !result) fail(400, `Vui lòng nhập ${label.toLowerCase()}.`);
  return result;
}
export async function bookKey(secret: string, library: string, fileId: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`book:${library}:${fileId}`))));
}
async function tokenKey(secret: string): Promise<CryptoKey> {
  const bytes = await crypto.subtle.digest('SHA-256', enc.encode(`managed-library:v1:${secret}`));
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function protectData(secret: string, purpose: string, value: Record<string, unknown>): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = enc.encode(JSON.stringify({ version: 1, purpose, value }));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await tokenKey(secret), payload));
  const bytes = new Uint8Array(12 + encrypted.length);
  bytes.set(iv); bytes.set(encrypted, 12);
  return base64url(bytes);
}
export async function revealData<T extends Record<string, unknown>>(secret: string, purpose: string, token: string): Promise<T> {
  try {
    if (!token || token.length > 16000 || !/^[\w-]+$/.test(token)) throw new Error();
    const bytes = decode(token);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, await tokenKey(secret), bytes.slice(12));
    const payload = JSON.parse(new TextDecoder().decode(plain));
    if (payload?.version !== 1 || payload?.purpose !== purpose || !payload.value || typeof payload.value !== 'object') throw new Error();
    return payload.value as T;
  } catch { return fail(400, 'Dữ liệu mã hóa không hợp lệ. Kiểm tra MASK_SECRET.'); }
}
export interface Resource {
  lib: string;
  kind: 'folder' | 'book' | 'page';
  id: string;
  parent?: string;
  page?: string;
  q?: string;
  exp?: number;
}
export async function seal(secret: string, resource: Resource): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await tokenKey(secret), enc.encode(JSON.stringify(resource))));
  const bytes = new Uint8Array(12 + encrypted.length);
  bytes.set(iv); bytes.set(encrypted, 12);
  return base64url(bytes);
}
export async function unseal(secret: string, token: string, lib: string, kind: Resource['kind']): Promise<Resource> {
  try {
    if (!token || token.length > 16000 || !/^[\w-]+$/.test(token)) throw new Error();
    const bytes = decode(token);
    const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, await tokenKey(secret), bytes.slice(12));
    const r = JSON.parse(new TextDecoder().decode(data)) as Resource;
    if (r.lib !== lib || r.kind !== kind || !/^[\w-]{10,60}$/.test(r.id) || (r.exp && r.exp < Date.now())) throw new Error();
    return r;
  } catch { return fail(400, 'Tham chiếu không hợp lệ hoặc đã hết hạn. Hãy tải lại thư mục.'); }
}
