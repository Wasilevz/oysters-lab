// Общие помощники для API-роутов.
// Файлы с префиксом "_" Vercel не публикует как отдельные эндпоинты.
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

let _supabase = null;
export function getSupabase() {
  if (!_supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY не заданы');
    }
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });
  }
  return _supabase;
}

export const JWT_OPTIONS = { algorithms: ['HS256'], issuer: 'oysters-lab', audience: 'oysters-lab-admin' };

// Проверяем подпись, алгоритм (защита от подмены alg), издателя и роль.
export function verifyToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ') || !process.env.JWT_SECRET) return false;
  const token = authHeader.slice(7).trim();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, JWT_OPTIONS);
    return payload && payload.role === 'admin';
  } catch {
    return false;
  }
}

export function noStore(res) {
  res.setHeader('Cache-Control', 'no-store');
}

// Отдаём клиенту общее сообщение, детали — только в логи.
export function serverError(res, error, context) {
  console.error(`[${context}]`, error);
  return res.status(500).json({ error: 'Ошибка сервера. Попробуйте ещё раз.' });
}

const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
export function isValidId(id) {
  return typeof id === 'string' && ID_RE.test(id);
}

// Белый список полей: всё, что не описано, отбрасывается (защита от mass assignment).
export function pick(obj, fields) {
  const out = {};
  for (const f of fields) if (Object.prototype.hasOwnProperty.call(obj, f)) out[f] = obj[f];
  return out;
}

/**
 * Универсальный CRUD-обработчик для таблиц с текстовым id.
 */
export function crudHandler({ table, fields, orderBy, validate, patchFields = [] }) {
  return async function handler(req, res) {
    noStore(res);
    if (!verifyToken(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let supabase;
    try { supabase = getSupabase(); } catch (e) { return serverError(res, e, table); }

    const { id } = req.query;

    switch (req.method) {
      case 'GET': {
        let q = supabase.from(table).select('*');
        if (orderBy) q = q.order(orderBy, { ascending: true });
        const { data, error } = await q;
        if (error) return serverError(res, error, `${table}:get`);
        return res.status(200).json(data);
      }

      case 'POST': {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        if (!isValidId(body.id)) {
          return res.status(400).json({ error: 'ID: только латиница, цифры, - и _ (до 64 символов)' });
        }
        const row = pick(body, fields);
        const problem = validate ? validate(row) : null;
        if (problem) return res.status(400).json({ error: problem });

        const { data, error } = await supabase.from(table).upsert(row, { onConflict: 'id' }).select();
        if (error) return serverError(res, error, `${table}:upsert`);
        return res.status(200).json({ success: true, data });
      }

      // Быстрое изменение флагов (скрыть/показать, в наличии) без пересохранения всей записи.
      case 'PATCH': {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        if (!isValidId(body.id)) return res.status(400).json({ error: 'Missing or invalid id' });
        const patch = pick(body, patchFields);
        if (!Object.keys(patch).length) return res.status(400).json({ error: 'Нечего обновлять' });
        if (Object.values(patch).some(v => typeof v !== 'boolean')) return res.status(400).json({ error: 'Некорректное значение' });
        const { data, error } = await supabase.from(table).update(patch).eq('id', body.id).select();
        if (error) return serverError(res, error, `${table}:patch`);
        if (!data || !data.length) return res.status(404).json({ error: 'Запись не найдена' });
        return res.status(200).json({ success: true, data: data[0] });
      }

      case 'DELETE': {
        if (!isValidId(id)) return res.status(400).json({ error: 'Missing or invalid id' });
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error && error.code === '23503') {
          return res.status(409).json({ error: 'Нельзя удалить: к записи привязаны другие данные (например, блюда в категории). Сначала перенесите или удалите их.' });
        }
        if (error) return serverError(res, error, `${table}:delete`);
        return res.status(200).json({ success: true });
      }

      default:
        res.setHeader('Allow', patchFields.length ? 'GET, POST, PATCH, DELETE' : 'GET, POST, DELETE');
        return res.status(405).json({ error: 'Method not allowed' });
    }
  };
}

export function isNonNegativeNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

// Ссылки на картинки — только http(s), чтобы в <img src> не попал javascript:/data:.
export function isSafeUrl(v) {
  if (v === '' || v == null) return true;
  if (typeof v !== 'string' || v.length > 2048) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

// Только для автотестов: подмена клиента Supabase.
export function __setSupabaseForTests(client) { _supabase = client; }
