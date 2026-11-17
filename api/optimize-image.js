import crypto from 'node:crypto';
import sharp from 'sharp';
import { getSupabase, verifyToken, noStore, serverError, isValidId } from './_lib.js';

// Пережимает одно фото записи (блюда или устрицы) без видимой потери качества:
//  • не меньше 2048px по длинной стороне (без увеличения), ориентация по EXIF;
//  • JPEG q=86 (mozjpeg), цвет без субдискретизации (4:4:4) — PSNR ~45–47 дБ;
//  • метаданные (в т.ч. GPS с телефона) удаляются;
//  • если выигрыш < 15% — файл не трогаем;
//  • оригинал НЕ удаляется: меняется только ссылка в записи.
const TABLES = { food_items: 'food_items', oysters: 'oysters' };
const MAX_SIDE = 2048;
const MIN_SAVING = 0.15;

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!verifyToken(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { table, id } = (req.body && typeof req.body === 'object') ? req.body : {};
  if (!TABLES[table] || !isValidId(id)) return res.status(400).json({ error: 'Некорректные параметры' });

  let supabase;
  try { supabase = getSupabase(); } catch (e) { return serverError(res, e, 'optimize'); }

  const { data: row, error: rowErr } = await supabase.from(table).select('id, image_url').eq('id', id).maybeSingle();
  if (rowErr) return serverError(res, rowErr, 'optimize:select');
  if (!row || !row.image_url) return res.status(200).json({ skipped: true, reason: 'no-image' });

  const prefix = `${process.env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/images/`;
  if (!row.image_url.startsWith(prefix)) return res.status(200).json({ skipped: true, reason: 'external' });
  const path = decodeURIComponent(row.image_url.slice(prefix.length).split('?')[0]);
  if (path.startsWith('opt/')) return res.status(200).json({ skipped: true, reason: 'already' });

  const { data: blob, error: dlErr } = await supabase.storage.from('images').download(path);
  if (dlErr) return serverError(res, dlErr, 'optimize:download');
  const input = Buffer.from(await blob.arrayBuffer());

  let output;
  try {
    output = await sharp(input, { failOn: 'none' })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: '4:4:4', progressive: true })
      .toBuffer();
  } catch (e) {
    return serverError(res, e, 'optimize:sharp');
  }

  if (output.length > input.length * (1 - MIN_SAVING)) {
    return res.status(200).json({ skipped: true, reason: 'small-gain', before: input.length, after: output.length });
  }

  const newPath = `opt/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
  const { error: upErr } = await supabase.storage.from('images').upload(newPath, output, {
    contentType: 'image/jpeg', cacheControl: '31536000', upsert: false
  });
  if (upErr) return serverError(res, upErr, 'optimize:upload');

  const url = supabase.storage.from('images').getPublicUrl(newPath).data.publicUrl;
  // Обновляем ссылку, только если её не поменяли параллельно.
  const { data: upd, error: updErr } = await supabase.from(table)
    .update({ image_url: url }).eq('id', id).eq('image_url', row.image_url).select('id');
  if (updErr || !upd || !upd.length) {
    await supabase.storage.from('images').remove([newPath]);
    if (updErr) return serverError(res, updErr, 'optimize:update');
    return res.status(409).json({ error: 'Фото изменилось во время обработки, попробуйте ещё раз' });
  }

  return res.status(200).json({ before: input.length, after: output.length, url, original: path });
}
