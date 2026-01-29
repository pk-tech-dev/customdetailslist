import { SortFilterType, DetailsListColumnType } from '../../../src/helpers/Enums';
import type { IDetailsListColumnDefinition } from '../../../src/helpers/Types';

export const columnDefinitions: IDetailsListColumnDefinition[] = [
  {
    fieldName: 'title',
    displayName: 'Title',
    minWidth: 120,
    maxWidth: 240,
    sortDetails: { fieldType: SortFilterType.Text },
    filterDetails: { fieldType: SortFilterType.Text },
    columnType: DetailsListColumnType.Text,
  },
  {
    fieldName: 'category',
    displayName: 'Category',
    minWidth: 120,
    maxWidth: 180,
    sortDetails: { fieldType: SortFilterType.Choice },
    filterDetails: { fieldType: SortFilterType.Choice },
    columnType: DetailsListColumnType.Text,
  },
  {
    fieldName: 'amount',
    displayName: 'Amount',
    minWidth: 90,
    maxWidth: 120,
    sortDetails: { fieldType: SortFilterType.Number },
    filterDetails: { fieldType: SortFilterType.NumberRange },
    columnType: DetailsListColumnType.Text,
  },
];
