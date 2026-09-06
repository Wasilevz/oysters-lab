import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.split(' ')[1];
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (!verifyToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;

  switch (req.method) {
    case 'GET': {
      const { data, error } = await supabase
        .from('food_categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }

    case 'POST': {
      const category = req.body || {};
      if (!category.id) {
        return res.status(400).json({ error: 'Поле id обязательно' });
      }
      const { data, error } = await supabase
        .from('food_categories')
        .upsert(category, { onConflict: 'id' });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, data });
    }

    case 'DELETE': {
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const { error } = await supabase.from('food_categories').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    default:
      res.setHeader('Allow', 'GET, POST, DELETE');
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
