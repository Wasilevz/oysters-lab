# Oyster's LAB — гастрономический гид

Меню ресторана Oyster's LAB: устрицы с вкусовыми профилями и происхождением, блюда по категориям. Три языка: русский, румынский, английский.

## Структура
- `index.html` — публичный сайт (HTML/CSS/JS без сборки). Данные читает из Supabase по anon-ключу.
- `admin.html` — админ-панель: устрицы, категории, блюда, фото, отметка «нет в наличии».
- `api/` — serverless-функции Vercel для админки (вход по паролю → JWT, CRUD, загрузка фото).
  - `api/_lib.js` — общая проверка токена, белые списки полей и валидация.
- `vercel.json` — заголовки безопасности (CSP, запрет фреймов и т. п.).

## Возможности сайта
- Меню с липкой навигацией по категориям и автоподсветкой текущей категории.
- Карточка блюда открывается шторкой (свайп вниз / Esc закрывает).
- Карточки устриц: шкала вкуса, происхождение, факты, листалка «Назад/Далее».
  Ссылка вида `/#gillardeau` открывает нужную устрицу.
- Язык запоминается, при первом визите берётся из настроек браузера.
- Меню кэшируется в браузере: повторное открытие (например, по QR-коду) — мгновенное, обновление в фоне.

## Переменные окружения (Vercel)
| Переменная | Назначение |
|---|---|
| `ADMIN_PASSWORD` | пароль админки (длинный, случайный) |
| `JWT_SECRET` | секрет подписи токенов (≥ 32 случайных символов) |
| `SUPABASE_URL` | URL проекта Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role ключ (только на сервере!) |

## Обязательно в Supabase: Row Level Security
Anon-ключ виден всем в `index.html`, поэтому таблицы должны быть **только для чтения** для анонимов:

```sql
alter table public.oysters         enable row level security;
alter table public.food_categories enable row level security;
alter table public.food_items      enable row level security;

create policy "public read" on public.oysters         for select to anon using (true);
create policy "public read" on public.food_categories for select to anon using (true);
create policy "public read" on public.food_items      for select to anon using (true);
-- политик на insert/update/delete для anon быть НЕ должно
```
Запись идёт только через `api/*` с service-role ключом. Бакет `images` — public на чтение, без политик записи для anon.

## Лицензия
MIT
