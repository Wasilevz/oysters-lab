import { crudHandler, isNonNegativeNumber, isSafeUrl, isValidId } from './_lib.js';

export default crudHandler({
  table: 'food_items',
  orderBy: 'sort_order',
  fields: [
    'id', 'category_id', 'name', 'price', 'weight', 'description',
    'image_url', 'sort_order', 'available', 'badge', 'hidden'
  ],
  patchFields: ['hidden', 'available'],
  validate(row) {
    if (!isValidId(row.category_id)) return 'Выберите категорию';
    if (!row.name || typeof row.name !== 'object' || !String(row.name.ru || '').trim()) {
      return 'Укажите название блюда (RU)';
    }
    if (row.price !== undefined && !isNonNegativeNumber(row.price)) return 'Некорректная цена';
    if (row.sort_order !== undefined && !Number.isInteger(row.sort_order)) return 'Порядок должен быть целым числом';
    if (!isSafeUrl(row.image_url)) return 'Некорректная ссылка на фото';
    if (row.available !== undefined && typeof row.available !== 'boolean') return 'Некорректное поле available';
    if (row.hidden !== undefined && typeof row.hidden !== 'boolean') return 'Некорректное поле hidden';
    return null;
  }
});
