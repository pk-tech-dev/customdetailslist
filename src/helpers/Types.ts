import type { IComboBoxOption } from "@fluentui/react";
import type { SortDirection, SortFilterType, DetailsListColumnType } from "./Enums";

export interface IDetailsListColumnSortDetails {
  fieldType: SortFilterType;
}

export interface IDetailsListColumnFilterDetails {
  fieldType: SortFilterType;
  filterOptions?: IComboBoxOption[];
  appliedFilters?: Array<{ filterKey: string | number; filterText: string | number }>;
}

export interface IDetailsListColumnDefinition {
  fieldName: string;
  displayName: string;
  minWidth?: number;
  maxWidth?: number;
  isIconOnly?: boolean;
  iconName?: string;
  disableHeaderMenu?: boolean;

  columnType?: DetailsListColumnType;
  sortDetails?: IDetailsListColumnSortDetails;
  filterDetails?: IDetailsListColumnFilterDetails;
}

export interface IDetailsListColumnSortField {
  fieldName: string;
  direction: SortDirection;
}

export interface IDetailsListColumnFilterField {
  fieldName: string;
  filterValues: string[];
}
