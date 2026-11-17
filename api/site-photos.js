import { crudHandler, isSafeUrl } from './_lib.js';

// Фото для лендинга /about. id — это «место» фото на странице.
export const SLOTS = ['hero', 'hall', 'oysters', 'bar', 'table', 'events'];

export default crudHandler({
  table: 'site_photos',
  fields: ['id', 'image_url'],
  validate(row) {
    if (!SLOTS.includes(row.id)) return 'Неизвестное место для фото';
    if (!isSafeUrl(row.image_url)) return 'Некорректная ссылка на фото';
    return null;
  }
});
