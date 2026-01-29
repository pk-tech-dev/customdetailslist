import * as React from 'react';
import { Icon } from '@fluentui/react';
import styles from './FilterChip.module.scss';

export interface IFilterChipValue {
  key: string;
  value: string;
}

export interface IFilterChipProps {
  filterValue: IFilterChipValue;
  onRemove?: (key: string) => void;
}

const FilterChip: React.FC<IFilterChipProps> = ({ filterValue, onRemove }) => {
  return (
    <span className={styles.chip} title={filterValue.value}>
      <span className={styles.text}>{filterValue.value}</span>
      <button
        type="button"
        className={styles.removeBtn}
        aria-label={`Remove ${filterValue.value}`}
        onClick={() => onRemove?.(filterValue.key)}
      >
        <Icon iconName="Cancel" />
      </button>
    </span>
  );
};

export default FilterChip;
