import { crudHandler, isNonNegativeNumber, isSafeUrl } from './_lib.js';

const TASTE = ['sal', 'iod', 'sw', 'meat'];

export default crudHandler({
  table: 'oysters',
  fields: [
    'id', 'name', 'badge', 'price', 'sal', 'iod', 'sw', 'meat', 'region_group',
    'available', 'terroir', 'description', 'origin', 'facts', 'image_url'
  ],
  validate(row) {
    if (typeof row.name !== 'string' || !row.name.trim()) return 'Укажите название';
    if (row.price !== undefined && !isNonNegativeNumber(row.price)) return 'Некорректная цена';
    for (const k of TASTE) {
      if (row[k] !== undefined && !(Number.isInteger(row[k]) && row[k] >= 0 && row[k] <= 10)) {
        return `Поле ${k} должно быть от 0 до 10`;
      }
    }
    if (!isSafeUrl(row.image_url)) return 'Некорректная ссылка на фото';
    if (row.available !== undefined && typeof row.available !== 'boolean') return 'Некорректное поле available';
    return null;
  }
});
