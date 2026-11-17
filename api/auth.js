import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { JWT_OPTIONS, noStore } from './_lib.js';

// Простейшая защита от перебора пароля. Память живёт, пока «тёплый» инстанс функции,
// поэтому это не полноценный rate-limit, но перебор существенно замедляет.
const attempts = new Map(); // ip -> { count, until }
const MAX_ATTEMPTS = 5;
const LOCK_MS = 10 * 60 * 1000;

function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '');
  return fwd.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

// Сравнение за постоянное время: хеши одинаковой длины, timingSafeEqual не «подсказывает» длину пароля.
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Сервер не настроен (нет ADMIN_PASSWORD/JWT_SECRET)' });
  }

  const ip = clientIp(req);
  const now = Date.now();
  const rec = attempts.get(ip);
  if (rec && rec.until > now) {
    const mins = Math.ceil((rec.until - now) / 60000);
    res.setHeader('Retry-After', String(Math.ceil((rec.until - now) / 1000)));
    return res.status(429).json({ error: `Слишком много попыток. Попробуйте через ${mins} мин.` });
  }

  const { password } = (req.body && typeof req.body === 'object') ? req.body : {};

  if (typeof password === 'string' && password.length <= 256 && safeEqual(password, process.env.ADMIN_PASSWORD)) {
    attempts.delete(ip);
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '12h',
      issuer: JWT_OPTIONS.issuer,
      audience: JWT_OPTIONS.audience
    });
    return res.status(200).json({ token });
  }

  const count = (rec && rec.until <= now && rec.count >= MAX_ATTEMPTS ? 0 : rec?.count || 0) + 1;
  attempts.set(ip, { count, until: count >= MAX_ATTEMPTS ? now + LOCK_MS : 0 });
  if (attempts.size > 5000) attempts.clear();

  await sleep(400); // небольшая задержка на каждую неудачную попытку
  return res.status(401).json({ error: 'Неверный пароль' });
}
