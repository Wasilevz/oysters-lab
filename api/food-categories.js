import { crudHandler } from './_lib.js';

export default crudHandler({
  table: 'food_categories',
  orderBy: 'sort_order',
  fields: ['id', 'label', 'subtitle', 'sort_order'],
  validate(row) {
    if (!row.label || typeof row.label !== 'object' || !String(row.label.ru || '').trim()) {
      return 'Укажите название категории (RU)';
    }
    if (row.sort_order !== undefined && !Number.isInteger(row.sort_order)) return 'Порядок должен быть целым числом';
    return null;
  }
});
