import crypto from 'node:crypto';
import { getSupabase, verifyToken, noStore, serverError } from './_lib.js';

// Разрешаем только растровые форматы. SVG/HTML запрещены: их можно использовать для XSS.
const ALLOWED = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif'
};
const MAX_BYTES = 3 * 1024 * 1024; // Vercel ограничивает тело запроса ~4.5 МБ (base64 раздувает на 33%)

// Проверяем «магические байты», а не верим заголовку от клиента.
function sniff(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.toString('ascii', 4, 12) === 'ftypavif') return 'image/avif';
  return null;
}

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { fileBase64 } = (req.body && typeof req.body === 'object') ? req.body : {};
  if (typeof fileBase64 !== 'string' || !fileBase64) {
    return res.status(400).json({ error: 'fileBase64 is required' });
  }

  const buffer = Buffer.from(fileBase64, 'base64');
  if (!buffer.length) return res.status(400).json({ error: 'Пустой файл' });
  if (buffer.length > MAX_BYTES) return res.status(413).json({ error: 'Файл слишком большой (макс. 3 МБ)' });

  const type = sniff(buffer);
  if (!type || !ALLOWED[type]) {
    return res.status(415).json({ error: 'Поддерживаются только JPG, PNG, WebP и AVIF' });
  }

  // Имя генерируем на сервере: никаких "../" и перезаписи чужих файлов.
  const fileName = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ALLOWED[type]}`;

  let supabase;
  try { supabase = getSupabase(); } catch (e) { return serverError(res, e, 'upload'); }

  const { error } = await supabase.storage.from('images').upload(fileName, buffer, {
    contentType: type,
    cacheControl: '31536000',
    upsert: false
  });
  if (error) return serverError(res, error, 'upload');

  const { data } = supabase.storage.from('images').getPublicUrl(fileName);
  return res.status(200).json({ url: data.publicUrl });
}
