import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Сервер не настроен (нет ADMIN_PASSWORD/JWT_SECRET)' });
  }

  const { password } = req.body || {};

  if (password && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign(
      { role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    return res.status(200).json({ token });
  }

  return res.status(401).json({ error: 'Неверный пароль' });
}
