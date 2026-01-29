import * as React from 'react';
import { initializeIcons } from '@fluentui/react';
import CustomDetailsList from '../../../src/components/CustomDetailsList/CustomDetailsList';
import { columnDefinitions } from './columns';
import { items } from './sampleData';

initializeIcons();

export default function App() {
  return (
    <div style={{ padding: 16 }}>
      <h2>Filterable DetailsList Demo</h2>
      <CustomDetailsList
        columnDefinitions={columnDefinitions}
        items={items}
        allItems={items}
        enableFilter={true}
      />
    </div>
  );
}
