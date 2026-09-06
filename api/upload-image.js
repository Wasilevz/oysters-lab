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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { fileName, fileBase64, contentType } = req.body || {};
  if (!fileName || !fileBase64) {
    return res.status(400).json({ error: 'fileName and fileBase64 are required' });
  }

  const buffer = Buffer.from(fileBase64, 'base64');

  const { error } = await supabase.storage
    .from('images')
    .upload(fileName, buffer, {
      contentType: contentType || 'image/jpeg',
      upsert: true
    });

  if (error) return res.status(500).json({ error: error.message });

  // ИСПРАВЛЕНО: getPublicUrl в Supabase v2 возвращает { data: { publicUrl } }
  const { data: publicUrlData } = supabase.storage.from('images').getPublicUrl(fileName);

  return res.status(200).json({ url: publicUrlData.publicUrl });
}
