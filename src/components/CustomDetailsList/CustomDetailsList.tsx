import * as React from 'react';
import styles from './CustomDetailsList.module.scss';
import { CheckboxVisibility, ColumnActionsMode, ComboBox, ContextualMenu, ContextualMenuItemType, DetailsList, DirectionalHint, IColumn, IComboBox, IComboBoxOption, Icon, IconButton, IContextualMenuItem, IContextualMenuProps, IDetailsHeaderProps, IDetailsListStyleProps, IDetailsListStyles, IDetailsRowProps, IDropdownOption, IObjectWithKey, IRenderFunction, IStyleFunctionOrObject, Selection, SelectionMode, Spinner, SpinnerSize, Stack, TextField } from '@fluentui/react';
import { useEffect, useState, useRef } from 'react';
import { SortFilterType, SortDirection, DetailsListColumnType } from '../../helpers/Enums';
import { IDetailsListColumnDefinition, IDetailsListColumnFilterDetails, IDetailsListColumnFilterField, IDetailsListColumnSortDetails, IDetailsListColumnSortField } from '../../helpers/Types';
import { difference, filter, find, get, isNumber, orderBy, some, sortBy, uniq, uniqBy } from 'lodash';
import classNames from 'classnames';
import { format } from 'date-fns';
import FilterChip, { IFilterChipValue } from '../filterChip/FilterChip';

export interface IFilterChipDetails{
  filterChipColumnName:string
  filterChipKeyColumnName:string
  onFilterChipRemove?: (removedItem: IObjectWithKey) => void;
}
export interface ILazyLoadDetails{
    enableLazyLoad: boolean;
    onLazyLoadTriggered: ()=>void;
    isLoading: boolean;
    moreItems: boolean;
}
export interface IStickyHeaderDetails{
    enableStickyHeader?: boolean
    maxHeight?: number
}
export interface ICustomDetailsListProps {
  columnDefinitions: IDetailsListColumnDefinition[];
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  allItems?: any[];
  checkboxVisible?: CheckboxVisibility;
  onRenderItemColumn?: (item?, index?: number, column?: IColumn) => React.ReactNode;
  onRenderDetailsHeader?: IRenderFunction<IDetailsHeaderProps>;
  onRenderRow?: IRenderFunction<IDetailsRowProps>;
  onSort?: (filteredColumns: IColumn[], sortColumn: IColumn) => void;
  enableFilter?: boolean;
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  onFilter?: (filteredColumns: IColumn[], sortColumn: IColumn) => void;
  className?: string;
  initialSort?: IDetailsListColumnSortField;
  initialFilters?: IDetailsListColumnFilterField[];
  dateFormat?:string,
  timeFormat?:string,
  maxSelectionCount?:number,
  onSelectionChange?: (selectedItems: IObjectWithKey[]) => void
  filterChipDetails?:IFilterChipDetails
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDoubleClickRow?: (item?: any, index?: number, ev?: Event) => void
  lazyLoadDetails?: ILazyLoadDetails
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDefaultFilterApplied?: (items: any[], filterColumns: IColumn[], sortColumn: IColumn)=>void
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDefaultSortApplied?: (items: any[], filterColumns: IColumn[], sortColumn: IColumn)=> void
  stickyHeaderDetails?: IStickyHeaderDetails
}

const CustomDetailsList: React.FunctionComponent<ICustomDetailsListProps> = (props: ICustomDetailsListProps) => {
    const {
        columnDefinitions,
        checkboxVisible,
        items,
        allItems,
        onRenderItemColumn,
        onRenderDetailsHeader,
        onRenderRow,
        onSort,
        enableFilter,
        onFilter,
        className,
        initialSort,
        initialFilters,
        dateFormat,
        timeFormat,
        maxSelectionCount,
        onSelectionChange,
        filterChipDetails,
        onDoubleClickRow,
        lazyLoadDetails,
        onDefaultFilterApplied,
        onDefaultSortApplied,
        stickyHeaderDetails
    } = props;

    const [columns, setColumns] = useState<IColumn[]>([]);

    const [columnContextMenuProps, setColumnContextMenuProps] = useState<IContextualMenuProps>();
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [allItemsLocal, _setAllItemsLocal] = useState<any[]>(allItems || [...items]);

    // use the ref pattern so we can update this array later base on items changes
    const allItemsLocalRef = React.useRef(allItemsLocal);
    const setAllItemsLocal = (data): void => {
        allItemsLocalRef.current = data;
        _setAllItemsLocal(data);
    }
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [finalItems, _setFinalItems] = useState<any[]>([...items]);
    const finalItemsRef = React.useRef(finalItems);
    const setFinalItems = (items): void => {
        finalItemsRef.current = items;
        _setFinalItems(items);
    }

    const searchInputRef = useRef(null)
    const minInputRef = useRef(null)
    const maxInputRef = useRef(null)
    const isFilterAddedToColumns = columnDefinitions.some(c=> c.filterDetails)
    const observer = useRef<IntersectionObserver | null>(null);
    const lazyLoadRef = useRef<HTMLElement | null>(null);

    const setLazyLoadRef = (node: HTMLElement | null) : void => {
        if (observer.current && lazyLoadRef.current) {
            observer.current.unobserve(lazyLoadRef.current);
        }
        lazyLoadRef.current = node;
        if (node && observer.current) {
            observer.current.observe(node);
        }
    };

    const renderLazyLoadRow = (createObserver: boolean = true): JSX.Element => {
        return lazyLoadDetails.moreItems
        ?
            <div className={styles.lazyLoaderSpinner} ref={createObserver ? setLazyLoadRef : undefined}>
                <Spinner label='Loading...' size={SpinnerSize.medium} labelPosition='left' />
            </div>
        : null;
    }

    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _filterItems = (items, filteredColumns: IColumn[]) : any[] => {
        let filteredItems = items
        filteredColumns.forEach((column) => {
            const filterDetails = column.data.filterDetails as IDetailsListColumnFilterDetails;
            const appliedFilterValues = (filterDetails.appliedFilters || []).map((af) => af.filterText);

            switch (filterDetails.fieldType) {
                case SortFilterType.Text:
                case SortFilterType.Choice:
                case SortFilterType.PartialChoice: {
                    filteredItems = filteredItems.filter((item) => {
                        const itemVal = item[column.fieldName];
                        if (appliedFilterValues.length > 0) {

                            // check to see if the item matches any of the applied filters
                            let matchesFilter = false;
                            for (let i = 0; i < appliedFilterValues.length; i++) {
                                const filterValue = appliedFilterValues[i] as string;
                                const isTimeColumn = DetailsListColumnType.Time === column.data.columnType
                                
                                if(itemVal && itemVal !== null)
                                {
                                    // if they match exactly (which covers blanks) or the filter is non-blank and partially matches the item, in both cases its a match
                                    if (isTimeColumn){                                        
                                        if(format(itemVal, column.data.timeFormat) === filterValue) {
                                            matchesFilter = true;      
                                            break;                                      
                                        }
                                        
                                    }
                                    else if (itemVal && itemVal !== null &&
                                        (itemVal.toLowerCase() === filterValue.toLocaleLowerCase() || (filterValue && itemVal?.toLowerCase().indexOf(filterValue.toLocaleLowerCase()) > -1))) {
                                        matchesFilter = true;
                                        break;
                                    }
                                }
                                
                            }

                            return matchesFilter;
                        } else {
                            // include all if no filters are applied
                            return true;
                        }
                    });
                    break;
                }
                case SortFilterType.Number: {
                    filteredItems = filteredItems.filter((item) => {
                        const itemVal = item[column.fieldName];
                        if (appliedFilterValues.length > 0) {
                            // check to see if the item matches any of the applied filters
                            const minvVal = find(filterDetails.appliedFilters, { filterKey: "minvalue" }) ?? undefined
                            const maxVal = find(filterDetails.appliedFilters, { filterKey: "maxvalue" }) ?? undefined

                            if (minvVal && itemVal < Number(minvVal.filterText)) return false;
                            if (maxVal && itemVal > Number(maxVal.filterText)) return false;
                            return true;
                        } else {
                            // include all if no filters are applied
                            return true;
                        }
                    });
                    break;
                }
            }
        });
        return filteredItems
    }

    const getTimeInMinutesFromDate = (itemValue) : number => {
        if(itemValue)
        {   const dateObj = new Date(itemValue);
            const hours = dateObj.getHours();     // 0–23
            const minutes = dateObj.getMinutes(); // 0–59
            return hours * 60 + minutes;
        }
        return -1
    };

    const getTimeForField = (item, fieldName) : number => {
        if(item[fieldName])
        {
            return getTimeInMinutesFromDate(item[fieldName])
        }
        return -1
    };

    const _applyDefaultSort = (column: IColumn, filteredColumns: IColumn[]): void => {
        let sortedItems = [...allItemsLocalRef.current];
        const sortDetails = column.data.sortDetails as IDetailsListColumnSortDetails;
        const sortColumnType = sortDetails?.fieldType

        switch(sortColumnType)
        {
            case SortFilterType.Time:
                sortedItems = orderBy(sortedItems, [(item) => getTimeForField(item, column.key)], column.isSortedDescending ? ['desc'] : ['asc']);
            break;
            default:
                sortedItems = orderBy(sortedItems, column.fieldName, column.isSortedDescending ? 'desc' : 'asc');
        }

        //Apply any existing filter after sorting
        if(filteredColumns)
        {
            sortedItems = _filterItems(sortedItems, filteredColumns)
        }
        setFinalItems([...sortedItems])

        if(onDefaultSortApplied)
        {
            onDefaultSortApplied(sortedItems, filteredColumns, column)
        }
    }

    const _handleSort = (column: IColumn,filteredColumns: IColumn[] ): void => {
        ///Is onSort not passed than apply default sort
        if (onSort) {

            //const existingFilterColumns = columns.filter(col => col.isFiltered)
            onSort(filteredColumns, column);
            //setFinalItems(newItems)
        }
        else
        {
            _applyDefaultSort(column, filteredColumns)
        }
    }

    const _applyDefaultFilter = (filteredColumns: IColumn[], sortColumn: IColumn): void => {

        let filteredItems = [...allItemsLocalRef.current]
        // // Apply filters based on the filteredColumns
        filteredItems = _filterItems(filteredItems,filteredColumns)

        // Sort the filtered items if a sort column is provided
        if (sortColumn) {
            filteredItems = orderBy(filteredItems, sortColumn.fieldName, sortColumn.isSortedDescending ? 'desc' : 'asc');
        }
        setFinalItems([...filteredItems])

        if(onDefaultFilterApplied)
        {
            onDefaultFilterApplied(filteredItems, filteredColumns, sortColumn)
        }
    }
    const _handleFilter = (filteredColumns: IColumn[], sortColumn: IColumn): void => {
        if (onFilter) {
            onFilter(filteredColumns, sortColumn);
        }
        else
        {
            _applyDefaultFilter(filteredColumns, sortColumn)
        }
    }
    const _handleSortOptionClicked = (column: IColumn, direction: SortDirection): void => {
        const isSortedByColumnAlready = column.isSorted &&
            ((direction === SortDirection.Asc && !column.isSortedDescending)
            || (direction === SortDirection.Desc && column.isSortedDescending)
        );

        if (!isSortedByColumnAlready) {
            let newSortColumn: IColumn;
            let existingFilterColumns: IColumn[] = [];

            setColumns((prevColumns) => {
                prevColumns.forEach((col) => {
                    if (col.key === column.key) {
                        col.isSorted = true;
                        col.isSortedDescending = direction === SortDirection.Desc ? true : false;
                        newSortColumn = col;
                    } else {
                        col.isSorted = false;
                    }
                });

                const updatedColumns = [...prevColumns]
                existingFilterColumns = updatedColumns.filter(col => col.isFiltered);

                return updatedColumns;
            });

            if (newSortColumn)
            {
                _handleSort(newSortColumn, existingFilterColumns)
            }

        }
    }

    const _getComboboxOptionsForAutocomplete = (column: IColumn, filterText?: string): IComboBoxOption[] => {
      let comboboxOptions: IComboBoxOption[] = []

      switch (column.data.columnType) {
        case DetailsListColumnType.Time: {
            let colValues = allItemsLocalRef.current.map(item => {
                    return item[column.fieldName]
                })
            colValues = orderBy(colValues, [getTimeInMinutesFromDate], ['asc']);
            colValues.map((v, i) => {
                if (v) {
                    comboboxOptions.push({
                        key: i + 1,
                        text: format(v, column.data.timeFormat)
                    })
                }
            })
            comboboxOptions = uniqBy(comboboxOptions, c=>c.text)
            break
        }
        default: {
              const distinctColValues = uniqBy(
                  allItemsLocalRef.current.map(item => {
                      return item[column.fieldName]
                  }),
                  (c) => c
              );

              // add 1 to index so we don't have to deal with key === 0 checks
              comboboxOptions = distinctColValues.map((v, i) => ({
                  key: i + 1,
                  text: v
              }));

              break;
          }
      }

      if (filterText) {
          comboboxOptions = comboboxOptions.filter((c) => c.text.toLowerCase().indexOf(filterText.toLowerCase()) > -1)
      }

      return comboboxOptions;
    }

    const _dismissColumnContextMenu = (): void => {
        setColumnContextMenuProps(undefined);
    }

    const _getColumnContextMenuProps = (column: IColumn): IContextualMenuProps => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const sortMenuItems = _getSortMenuItems(column);
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const filterMenuItems = _getFilterMenuItems(column);

    return {
        items: [].concat(sortMenuItems, filterMenuItems),
        target: column.data.filterTarget as HTMLElement,
        directionalHint: DirectionalHint.bottomLeftEdge,
        isBeakVisible: false,
        onDismiss: _dismissColumnContextMenu,
    }
  }

  const _handleColumnContextMenu = (column: IColumn): void => {
      if (column.columnActionsMode !== ColumnActionsMode.disabled) {
        setColumnContextMenuProps(_getColumnContextMenuProps(column));
      }
  }

  const _handleFilterDropdownChange = (
      event: React.FormEvent<HTMLDivElement> | React.FormEvent<IComboBox> | React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
      column: IColumn,
      item?: IDropdownOption,
      index?: number,
      partialValueOrKey?: string | number,
      skipRerender?: boolean
  ): void => {
      let existingColumn: IColumn
      let sortColumn: IColumn
      let filterKey: string | number = ''
      let filterText: string | number = ''
      if (item) {
          filterKey = isNumber(item.key) ? item.key : item.key //.toLowerCase();
          filterText = item.text;
      } else if (partialValueOrKey) {
          filterKey = isNumber(partialValueOrKey) ? partialValueOrKey : partialValueOrKey //.toLowerCase();
          filterText = filterKey;
      }

      let updatedColumns: IColumn[];
      setColumns((prevColumns) => {
        prevColumns.forEach((col) => {
          // filtering is disabled unless action mode is "hasDropdown"
          if (col.columnActionsMode === ColumnActionsMode.hasDropdown) {
              const filterDetails: IDetailsListColumnFilterDetails = col.data.filterDetails;
              if (col.key === column.key) {
                  existingColumn = col;

                  // ensure we have appliedFilters array initialized
                  if (!filterDetails.appliedFilters) {
                      filterDetails.appliedFilters = [];
                  }

                  // if item is selected or we're dealing with a partialValue that's not already applied, then add the filter
                  if (get(item, 'selected') || (partialValueOrKey && !some(filterDetails.appliedFilters, { filterKey: filterKey }))) { // add filter to array
                      const appliedFilterKey = filterKey;
                      const appliedFilterText = filterText;
                      filterDetails.appliedFilters.push({
                          filterKey: appliedFilterKey,
                          filterText: appliedFilterText
                      })
                  } else { // remove filter from array
                      filterDetails.appliedFilters = filterDetails.appliedFilters.filter(af => af.filterKey !== filterKey);
                  }

                  // ensure isFiltered prop is set correctly
                  col.isFiltered = filterDetails.appliedFilters.length > 0;
              }
          }

          // record the sort column so we can pass it into functions outside of this loop
          if (col.isSorted) {
              sortColumn = col;
          }
        });

        updatedColumns = [...prevColumns];
        return updatedColumns;
      });

      const filteredColumns = updatedColumns.filter(col => col.isFiltered);

      _handleFilter(filteredColumns, sortColumn)


      // this rerenders the dropdown
      if (!skipRerender) {
          _handleColumnContextMenu(existingColumn);
      }
  }
  const _handleMinMaxNumberChange = (
    column: IColumn,
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    items?: any
): void => {
    let existingColumn: IColumn
    let sortColumn: IColumn
    let updatedColumns: IColumn[];
    setColumns((prevColumns) => {
      prevColumns.forEach((col) => {
        // filtering is disabled unless action mode is "hasDropdown"
        if (col.columnActionsMode === ColumnActionsMode.hasDropdown) {
            const filterDetails: IDetailsListColumnFilterDetails = col.data.filterDetails;
            if (col.key === column.key) {
                existingColumn = col;

                // ensure we have appliedFilters array initialized
                if (!filterDetails.appliedFilters) {
                    filterDetails.appliedFilters = [];
                }

                items.forEach(item => {
                    let filterKey: string | number = ''
                    let filterText: string | number = ''
                    if (item) {
                        filterKey = isNumber(item.key) ? item.key : item.key //.toLowerCase();
                        filterText = item.text;
                    }
                    if(filterText)
                    {
                        // if item is not already applied, then add the filter
                        if (!some(filterDetails.appliedFilters, { filterKey: filterKey })) {
                            const appliedFilterKey = filterKey;
                            const appliedFilterText = filterText;
                            filterDetails.appliedFilters.push({
                                filterKey: appliedFilterKey,
                                filterText: appliedFilterText
                            })
                        } else { // update filter value if already exist
                            const existingVal = find(filterDetails.appliedFilters, { filterKey: filterKey })
                            existingVal.filterText = filterText
                        }
                    }
                });

                //Check if min and max both are present, then reorder them [min, max]
                if(filterDetails.appliedFilters.length > 1)
                {
                    const filters = []
                    filters.push(filterDetails.appliedFilters.find(c=>c.filterKey === 'minvalue'))
                    filters.push(filterDetails.appliedFilters.find(c=>c.filterKey === 'maxvalue'))

                    filterDetails.appliedFilters = filters
                }

                // ensure isFiltered prop is set correctly
                col.isFiltered = filterDetails.appliedFilters.length > 0;
            }
        }

        // record the sort column so we can pass it into functions outside of this loop
        if (col.isSorted) {
            sortColumn = col;
        }
      });

      updatedColumns = [...prevColumns];
      return updatedColumns;
    });

    const filteredColumns = updatedColumns.filter(col => col.isFiltered);

    _handleFilter(filteredColumns, sortColumn)

    _handleColumnContextMenu(existingColumn);

 }
//     const _getColumnSortValue = (rawValue, type: SortFilterType): unknown => {
//       let sortValue
//       switch (type) {
//           case SortFilterType.Number: {
//               if (typeof rawValue === 'string') {
//                   sortValue = parseInt(rawValue.replace(',', ''));
//               } else {
//                   sortValue = rawValue;
//               }
//               break;
//           }
//           case SortFilterType.Date: {
//               sortValue = rawValue //new Date(rawValue || '1901-01-01');
//               break;
//           }
//           ////Following type not supported for now. Keep it if needed in future
//         //   case SortFilterType.Person: {
//         //       let personObj = rawValue;
//         //       if (Array.isArray(rawValue) && rawValue.length > 0) {
//         //           personObj = rawValue[0];
//         //       }

//         //       //TODO: update this to work with our people object
//         //       let value = get(personObj, 'title') || get(personObj, 'Title') || get(personObj, 'displayName');
//         //       if (value) {
//         //           value = value.toLowerCase();
//         //       }
//         //       sortValue = value;
//         //       break
//         //   }
//         //   case SortFilterType.Percent: {
//         //       if (typeof rawValue === 'string') {
//         //           sortValue = parseInt(rawValue.replace('%', ''));
//         //       } else {
//         //           sortValue = rawValue;
//         //       }
//         //       break;
//         //   }
//           default: {
//               sortValue = rawValue ? rawValue.toLowerCase() : undefined;
//           }
//       }

//       return sortValue;
//   }

//   const _getDropdownFilterMenu = (
//       selectedFilterValue: (string | number)[],
//       dropdownOptions: IDropdownOption[],
//       column: IColumn,
//       filterDetails: IDetailsListColumnFilterDetails
//   ): IContextualMenuItem => {

//       // check to see if the selected filter keys match existing option keys
//       // if any of them don't check if they actually match the text instead
//       const finalFilterKeys = [];
//       selectedFilterValue.forEach(selectedKey => {
//           if (!find(dropdownOptions, { key: selectedKey })) {
//               const matchByText = find(dropdownOptions, { text: selectedKey }) as IDropdownOption;
//               // if we find a match we keep it, if there is no match we don't use this filter
//               if (matchByText) {
//                   finalFilterKeys.push(matchByText.key);

//                   // since we found the real key for this filter
//                   // we need to update the appliedFilters array that's inside the column with the real key
//                   // or we can't deselect the option
//                   const appliedFilter = find(filterDetails.appliedFilters, { filterKey: selectedKey })
//                   if (appliedFilter) {
//                       appliedFilter.filterKey = matchByText.key;
//                   }
//               }
//           } else {
//               finalFilterKeys.push(selectedKey);
//           }
//       })

//       return {
//           key: 'dropdownFilter',
//           name: 'dropdownFilter',
//           onRender: () => {
//               return (
//                   <div className={styles.filterDropdown}>
//                       <Dropdown
//                           placeholder="Select option"
//                           label=""
//                           selectedKeys={finalFilterKeys}
//                           options={dropdownOptions}
//                           onChange={(event, item, index) => _handleFilterDropdownChange(event, column, item, index)}
//                           multiSelect={true}
//                       />
//                   </div>
//               )
//           },
//       }
//   }

  const _getSortMenuItems = (column: IColumn): IContextualMenuItem[] => {
      const menuItems: IContextualMenuItem[] = [];
      const sortDetails = column.data.sortDetails as IDetailsListColumnSortDetails;
      if (sortDetails) {
        const isSortedAsc = column.isSorted && !column.isSortedDescending;
        const isSortedDesc = column.isSorted && column.isSortedDescending;
        switch (sortDetails.fieldType) {
            case SortFilterType.Number:
            case SortFilterType.NumberRange: {
                menuItems.push({
                    key: 'ascNumber',
                    name: 'Sorting - Smaller to larger',
                    iconProps: { iconName: 'SortUp' },
                    canCheck: true,
                    checked: isSortedAsc,
                    onClick: () => {
                      _handleSortOptionClicked(column, SortDirection.Asc);
                    },
                })

                menuItems.push({
                    key: 'descNumber',
                    name: 'Sorting - Larger to smaller',
                    iconProps: { iconName: 'SortDown' },
                    canCheck: true,
                    checked: isSortedDesc,
                    onClick: () => {
                      _handleSortOptionClicked(column, SortDirection.Desc);
                    },
                })
                break
            }
            case SortFilterType.Time:
            case SortFilterType.Date: {
                menuItems.push({
                    key: 'ascDate',
                    name: 'Older to newer',
                    iconProps: { iconName: 'SortUp' },
                    canCheck: true,
                    checked: isSortedAsc,
                    onClick: () => {
                        _handleSortOptionClicked(column, SortDirection.Asc)
                    },
                })

                menuItems.push({
                    key: 'descDate',
                    name: 'Newer to older',
                    iconProps: { iconName: 'SortDown' },
                    canCheck: true,
                    checked: isSortedDesc,
                    onClick: () => {
                        _handleSortOptionClicked(column, SortDirection.Desc)
                    },
                })
                break
            }
            case SortFilterType.Text:
            case SortFilterType.PartialChoice:
            case SortFilterType.Choice:
            default: {
                menuItems.push({
                    key: 'ascText',
                    name: 'Sorting - A to Z',
                    iconProps: { iconName: 'SortUp' },
                    canCheck: true,
                    checked: isSortedAsc,
                    onClick: () => {
                        _handleSortOptionClicked(column, SortDirection.Asc)
                    },
                })

                menuItems.push({
                    key: 'descText',
                    name: 'Sorting - Z to A',
                    iconProps: { iconName: 'SortDown' },
                    canCheck: true,
                    checked: isSortedDesc,
                    onClick: () => {
                        _handleSortOptionClicked(column, SortDirection.Desc)
                    },
                })

                break
            }
        }
      }

      return menuItems
  }

  const _getFilterMenuItems = (column: IColumn): IContextualMenuItem[] => {
      const filterMenuItems: IContextualMenuItem[] = []
      if (enableFilter) {
          const filterDetails = column.data.filterDetails as IDetailsListColumnFilterDetails;
          let isFilterAllowedForColumn = filterDetails ?? false
          //Currently filter is not implemented for date column
          if(isFilterAllowedForColumn && filterDetails.fieldType === SortFilterType.Date)
          {
            isFilterAllowedForColumn = false
          }
          if (isFilterAllowedForColumn) {
              filterMenuItems.push({
                  key: 'sectionFilter',
                  name: 'Filter By',
                  itemType: ContextualMenuItemType.Divider,
              })
              filterMenuItems.push({
                  key: 'sectionFilter',
                  name: 'Filter By',
                  canCheck: true,
                  checked: column.isFiltered,
                  itemProps: {
                      styles: {
                        linkContent: styles.headerLabel,
                      },
                  },
                  disabled: true,
                  iconProps: { styles: {} },
              })
              const appliedFilters = filterDetails.appliedFilters || [];
              const selectedFilterKeys = column.isFiltered ? appliedFilters.map(af => af.filterKey) : [];
              const selectedFilterTexts = column.isFiltered ? appliedFilters.map(af => af.filterText) : [];
              switch (filterDetails.fieldType) {
                case SortFilterType.Text: {
                  let textFieldKey = (new Date()).getTime();
                  filterMenuItems.push({
                    key: 'textFilter',
                    name: 'textFilter',
                    onRender: () => {
                      return (
                        <div className={styles.searchContainer}>
                          <div className={styles.searchTextboxDiv}>
                            <TextField
                            key={textFieldKey}
                            componentRef={searchInputRef}
                            placeholder='Search...'
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                _handleFilterDropdownChange(e, column, undefined, undefined, e.currentTarget.value);

                                // reset key to force rerender and clear textbox
                                textFieldKey = (new Date()).getTime();
                              }
                            }}
                          />
                          <IconButton
                            iconProps={{ iconName: "Search" }}
                            onClick={(e) =>{

                                _handleFilterDropdownChange(undefined, column, undefined, undefined,searchInputRef.current.value);

                                // reset key to force rerender and clear textbox
                                textFieldKey = (new Date()).getTime();
                            }}
                            //className={styles.trashIcon}
                          />
                            </div>
                          {column.isFiltered &&
                              <Stack className={styles.imputFilterValues}>
                                  {appliedFilters.map((af, index) => (
                                      <div key={index} className={styles.filterValueRow}>
                                          <span className={styles.filterValue}>{af.filterText}</span>
                                          <Icon
                                            iconName="ChromeClose"
                                            className={styles.removeIcon}
                                            onClick={() => { _handleFilterDropdownChange(undefined, column, undefined, undefined, af.filterKey) }}
                                          />
                                      </div>
                                  ))}
                              </Stack>
                          }
                        </div>
                      )
                    }
                  });
                  break;
                }
                case SortFilterType.Time:
                case SortFilterType.Choice:
                case SortFilterType.PartialChoice: {
                    const isChoiceField = filterDetails.fieldType === SortFilterType.Choice || filterDetails.fieldType === SortFilterType.Time
                    let comboboxOptions: IComboBoxOption[] = []

                    //If options are sent explicitly then use those. Else extract options from column values
                    if(filterDetails.filterOptions && filterDetails.filterOptions.length > 0)
                    {
                        comboboxOptions = filterDetails.filterOptions
                    }
                    else if(column.data.columnType === DetailsListColumnType.Time)
                    {
                        comboboxOptions = _getComboboxOptionsForAutocomplete(column)
                    }
                    else
                    {
                        comboboxOptions = sortBy(
                            _getComboboxOptionsForAutocomplete(column),
                            (o) => o.text && o.text.toLowerCase()
                        )
                    }

                    // check to see if the selected filter keys match existing option keys
                    // if any of them don't check if they actually match the text instead
                    const finalFilterKeys = [];
                    selectedFilterKeys.forEach(selectedKey => {
                    const matchByText = find(comboboxOptions, { key: selectedKey }) as IComboBoxOption;
                    if (matchByText) {
                        finalFilterKeys.push(matchByText.key);

                        // since we found the real key for this filter
                        // we need to update the appliedFilters array that's inside the column with the real key
                        // or we can't deselect the option
                        const appliedFilter = find(filterDetails.appliedFilters, { filterKey: selectedKey });
                        if (appliedFilter) {
                            appliedFilter.filterKey = matchByText.key;
                        }
                    } else {
                        finalFilterKeys.push(selectedKey);
                    }
                    });

                    filterMenuItems.push({
                        key: 'dropdownFilter',
                        name: 'dropdownFilter',
                        onRender: () => {
                            return (
                                <div className={styles.filterDropdown}>
                                    <ComboBox
                                        label=""
                                        allowFreeform={isChoiceField ? false : true}
                                        autoComplete={isChoiceField ? "off" : "on"}
                                        placeholder="Select option"
                                        options={comboboxOptions}
                                        selectedKey={finalFilterKeys}
                                        text={!selectedFilterKeys && selectedFilterTexts ? selectedFilterTexts.join('; ') : ''}
                                        onChange={(event, option, index, value) =>
                                            _handleFilterDropdownChange(event, column, option, index, value)
                                        }
                                        useComboBoxAsMenuWidth={true}
                                        multiSelect={true}
                                        calloutProps={{styles:{root:{width: 'fit-content', maxWidth:350, minWidth: 215}}}}
                                    />
                                    {column.isFiltered &&
                                        <Stack className={styles.imputFilterValues}>
                                            {appliedFilters.map((af, index) => (
                                                <div key={index} className={styles.filterValueRow}>
                                                    <span className={styles.filterValue}>{af.filterText}</span>
                                                    <Icon
                                                    iconName="ChromeClose"
                                                    className={styles.removeIcon}
                                                    onClick={() => { _handleFilterDropdownChange(undefined, column, undefined, undefined, af.filterKey) }}
                                                    />
                                                </div>
                                            ))}
                                        </Stack>
                                    }

                                </div>
                            )
                        },
                    })
                    break
                }
                case SortFilterType.Number: {
                    let numberFieldKey = (new Date()).getTime();
                    filterMenuItems.push({
                      key: 'numberFilter',
                      name: 'numberFilter',
                      onRender: () => {
                        return (
                            <div className={styles.searchContainer}>
                                <div className={styles.searchTextboxDiv}>
                                    <TextField
                                        key={numberFieldKey}
                                        componentRef={searchInputRef}
                                        placeholder='Search...'
                                        type='number'
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = e.currentTarget.value ? Number(e.currentTarget.value) : undefined
                                                _handleFilterDropdownChange(e, column, undefined, undefined, val);

                                                // reset key to force rerender and clear textbox
                                                numberFieldKey = (new Date()).getTime();
                                            }
                                        }}
                                    />
                                    <IconButton
                                        iconProps={{ iconName: "Search" }}
                                        onClick={(e) => {
                                            const val = searchInputRef.current.value ? Number(searchInputRef.current.value) : undefined
                                            _handleFilterDropdownChange(undefined, column, undefined, undefined, val);

                                            // reset key to force rerender and clear textbox
                                            numberFieldKey = (new Date()).getTime();
                                        }}
                                    //className={styles.trashIcon}
                                    />
                                </div>
                                {column.isFiltered &&
                                    <Stack className={styles.imputFilterValues}>
                                        {appliedFilters.map((af, index) => (
                                            <div key={index} className={styles.filterValueRow}>
                                                <span className={styles.filterValue}>{af.filterText}</span>
                                                <Icon
                                                    iconName="ChromeClose"
                                                    className={styles.removeIcon}
                                                    onClick={() => { _handleFilterDropdownChange(undefined, column, undefined, undefined, af.filterKey) }}
                                                />
                                            </div>
                                        ))}
                                    </Stack>
                                }
                            </div>
                        )
                      }
                    });
                    break;
                }
                case SortFilterType.NumberRange:{

                    filterMenuItems.push({
                        key: 'numberRangeFilter',
                        name: 'numberRangeFilter',
                        onRender: () => {
                            let minFieldKey = `min${(new Date()).getTime()}`;
                            let maxFieldKey = `max${(new Date()).getTime()}`;
                            return (
                                <div className={styles.searchContainer}>
                                    <div className={styles.numberSearchDiv}>
                                        <div>
                                        <TextField
                                            key={minFieldKey}
                                            type='number'
                                            placeholder="Min"
                                            componentRef={minInputRef}
                                            onKeyDown={(e) =>{

                                                if( e.key === 'Enter')
                                                {
                                                    _handleMinMaxNumberChange(column, [{ key: "minvalue", text: e.currentTarget.value }])

                                                    // reset key to force rerender and clear textbox
                                                    minFieldKey = `min${(new Date()).getTime()}`
                                                }

                                            }}
                                        /></div>
                                        <span>-</span>
                                        <div>
                                        <TextField
                                            key={maxFieldKey}
                                            type="number"
                                            placeholder="Max"
                                            componentRef={maxInputRef}
                                            //onChange={(e) => setMaxInput(e.currentTarget.value)}
                                            onKeyDown={(e) => {
                                                if(e.key === 'Enter')
                                                {
                                                    _handleMinMaxNumberChange(column, [{ key: "maxvalue", text: e.currentTarget.value }])

                                                    // reset key to force rerender and clear textbox
                                                    maxFieldKey = `max${(new Date()).getTime()}`
                                                }
                                            }}
                                        /></div>
                                        <IconButton
                                            iconProps={{ iconName: "Search" }}
                                            onClick={(e) =>{
                                                _handleMinMaxNumberChange(column, [{ key: "minvalue", text: minInputRef.current.value }, { key: "maxvalue", text: maxInputRef.current.value }])
                                                //_handleMinMaxNumberChange(column, { key: "maxvalue", text: maxInputRef.current.value })
                                                //reset key to force rerender and clear textbox
                                                minFieldKey = `min${(new Date()).getTime()}`
                                                maxFieldKey = `max${(new Date()).getTime()}`

                                            }}
                                        />
                                    </div>
                                    {column.isFiltered &&
                                        <Stack className={styles.imputFilterValues}>
                                            {appliedFilters.map((af, index) => {
                                                const labelVal = af.filterKey === "minvalue" ? "Min" :  "Max"

                                                return (
                                                    <div key={index} className={styles.filterValueRow}>
                                                        <span className={styles.filterValue}>{labelVal} : {af.filterText}</span>
                                                        <Icon
                                                        iconName="ChromeClose"
                                                        className={styles.removeIcon}
                                                        onClick={() => { _handleFilterDropdownChange(undefined, column, undefined, undefined, af.filterKey) }}
                                                        />
                                                    </div>
                                                )}
                                            )}

                                        </Stack>
                                    }
                                </div>
                            )
                        },
                    })
                    break
                }

                ////Following type not supported for now. Keep it if needed in future
                //TODO - Need to implement it in future if we need filtering on Date. Partially working
                //   case SortFilterType.Date: {
                //       let distinctDateValues = uniqBy(
                //           finalItems.map(function (item) {
                //               let val = item[column.fieldName]
                //               let dt: Date = new Date(val || '1901-01-01');
                //               return val
                //                   ? {
                //                       rawValue: val.split(' ')[0].split('T')[0],
                //                       formattedValue: format(dt,dateFormat),
                //                   }
                //                   : {
                //                       rawValue: '',
                //                       formattedValue: '',
                //                   }
                //           }),
                //           (c) => c.formattedValue
                //       )

                //       distinctDateValues.sort((d1, d2) => {
                //           const date1 = d1
                //           const date2 = d2

                //           if (date1 < date2) {
                //               return -1
                //           } else if (date1 > date2) {
                //               return 1
                //           } else {
                //               return 0
                //           }
                //       })

                //       let dateDropdownOptions = distinctDateValues.map((vObj, i) => {
                //           // add 1 to index so we don't have to deal with key === 0 checks
                //           return { key: i + 1, text: vObj.formattedValue }
                //       })

                //       // remove any empty dates, sort the rest, and add empty date back to top
                //       const emptyValue = remove(dateDropdownOptions, (o) => !o.key)
                //       dateDropdownOptions = sortBy(dateDropdownOptions, (o) => o.key
                //       ).reverse() as any
                //       dateDropdownOptions = [].concat(emptyValue, dateDropdownOptions)

                //       filterMenuItems.push(_getDropdownFilterMenu(selectedFilterKeys, dateDropdownOptions, column, filterDetails))

                //       break
                //   }
                //   case SortFilterType.Percent: {
                //       //const percentDropdownOptions = _sortBy(this.extractDistinctDropdownValues(column), (o) => parseInt(o.text.replace('%', '')))
                //       const percentDropdownOptions = sortBy(_extractDistinctDropdownValues(column), (o) =>
                //           _getColumnSortValue(o.text, SortFilterType.Percent)
                //       )
                //       filterMenuItems.push(_getDropdownFilterMenu(selectedFilterKeys, percentDropdownOptions, column, filterDetails))
                //       break
                //   }

                  default: {
                      break
                  }
              }
          }

          //Add "Clear Filter" option only if filter menu has filters
          if(filterMenuItems.length > 0 ){
            filterMenuItems.push({
                key: 'sectionClearFilter',
                name: 'Clear filter',
                canCheck: false,
                disabled: !column.isFiltered,
                itemProps: {
                    styles: {
                        linkContent: styles.headerLabel,
                    },
                },
                onClick: () => {
                    let updatedColumns: IColumn[];
                    setColumns((prevColumns) => {
                    const existingColumn = find(prevColumns, { key: column.key });
                    if (existingColumn.columnActionsMode === ColumnActionsMode.hasDropdown) {
                        existingColumn.isFiltered = false;
                        const filterDetails: IDetailsListColumnFilterDetails = existingColumn.data.filterDetails;
                        filterDetails.appliedFilters = [];
                    }

                    updatedColumns = [...prevColumns];
                    return updatedColumns;
                    });

                    const filteredColumns = updatedColumns.filter(col => col.isFiltered);
                    const sortColumn = find(updatedColumns, { isSorted: true });
                    _handleFilter(filteredColumns,sortColumn)

                },
                iconProps: { iconName: 'ClearFilter', style:{fontSize: "14px"} },
            })
          }
      }
      return filterMenuItems
  }

  const _buildColumns = (columnDefinitions: IDetailsListColumnDefinition[]): IColumn[] => {
    const columns: IColumn[] = columnDefinitions.map((colDef) => ({
        key: colDef.fieldName,
        fieldName: colDef.fieldName,
        name: colDef.displayName,
        maxWidth: colDef.maxWidth || 100,
        minWidth: colDef.minWidth || 100,
        columnActionsMode: colDef.disableHeaderMenu ? undefined : (!!colDef.sortDetails || !!colDef.filterDetails) ? ColumnActionsMode.hasDropdown : undefined,
        isIconOnly: colDef.isIconOnly,
        iconName: colDef.iconName,
        data: {
            sortDetails: colDef.sortDetails,
            filterDetails: colDef.filterDetails,
            columnType : colDef.columnType,
            dateFormat: dateFormat,
            timeFormat: timeFormat
        },
        onColumnContextMenu: (column, ev) => {
            column.data.filterTarget = ev.target;
            _handleColumnContextMenu(column);
        },
        onColumnClick: (ev, column) => {
            column.data.filterTarget = ev.target;
            _handleColumnContextMenu(column);
        },
        isSorted: false,
        isResizable: true,
    }))

    return columns;
  }

  const setUpInitialLoad = () : void => {
    //setFormsData([...items])
    const columns = _buildColumns(columnDefinitions);



    // get the initial sort column if one is defined
    const sortColumn = initialSort ? find(columns, { fieldName: initialSort.fieldName }) : undefined;
    if (sortColumn) {
        sortColumn.isSorted = true;
        sortColumn.isSortedDescending = initialSort.direction === SortDirection.Desc ? true : false;

        /** We are assuming, initially items are already sorted "initialSort"
         * So, apply initial sort only if custom sort is NOT set
         * */
        if (!onSort) {
            _handleSort(sortColumn, [])
        }

    }

    setColumns(columns);
    // apply any initial filters
    if (initialFilters && initialFilters.length > 0) {
        initialFilters.forEach(initialFilter => {
            if (initialFilter.filterValues.length > 0) {
                const filterColumn = find(columns, { fieldName: initialFilter.fieldName })
                if (filterColumn) {
                    // ensure we don't apply the same value multiple times
                    const uniqueFilterValues = uniq(initialFilter.filterValues);
                    uniqueFilterValues.forEach(filterValue => {
                        _handleFilterDropdownChange(undefined, filterColumn, { selected: true, key: filterValue, text: filterValue }, undefined, filterValue, true);
                    })
                }
            }
        })
    }
  }

  useEffect(() => {
        setAllItemsLocal(allItems || [...items])

        setFinalItems([...items])

        if(columns)
        {
            const sortColumn = columns.find(col => col.isSorted)
            const existingFilterColumns = columns.filter(col => col.isFiltered);
            if(existingFilterColumns && existingFilterColumns.length >0 && !onFilter)
            {
                //_applyDefaultFilter(existingFilterColumns,sortColumn, true)
                _handleFilter(existingFilterColumns,sortColumn)
            }
            else if(sortColumn && !onSort)
            {
                //_applyDefaultSort(sortColumn)
                _handleSort(sortColumn,existingFilterColumns)

            }

            if(sortColumn)
            {
                setColumns(columns)
            }

        }
    }, [items]);

  useEffect(() => {
    setUpInitialLoad()
  }, []);

  useEffect(() => {
    setUpInitialLoad()
  }, [columnDefinitions]);

  const _clearAllFilters = (): void => {
      let sortColumn: IColumn;

      setColumns((prevColumns) => {
        prevColumns.forEach((col) => {
          if (col.isFiltered) {
              col.isFiltered = false;

              // clear the applied filters
              const filterDetails: IDetailsListColumnFilterDetails = col.data.filterDetails;
              filterDetails.appliedFilters = [];
          }

          if (col.isSorted) {
              sortColumn = col;
          }
        });

        return [...prevColumns];
      });

      _handleFilter([], sortColumn)

  }
    const [tableSelectedItem, _setTableSelectedItem] = React.useState<IObjectWithKey[]>([]);
    const tableSelectedItemRef = React.useRef(tableSelectedItem);
    const setTableSelectedItem = (selectedItems): void => {
        tableSelectedItemRef.current = selectedItems;
        _setTableSelectedItem(selectedItems);
    }
    const prevSelectionIndices = useRef<number[]>()
    const filterSelectionRef = useRef<Selection>(new Selection({
            onSelectionChanged: () => {
                const currentSelection = filterSelectionRef.current
                const currentIndices = currentSelection.getSelectedIndices()
                const newSelectionCount = currentSelection.count

                if (maxSelectionCount && newSelectionCount > maxSelectionCount) {
                    difference(currentIndices, prevSelectionIndices.current).map((newlySelectedItemIndex) => {
                        setTimeout(() => {
                            // Ugly hack to wait for the checkbox to finish being checked before we uncheck it
                            currentSelection.setIndexSelected(newlySelectedItemIndex, false, false)
                        }, 1)
                    })
                } else {
                    const selected = currentSelection.getSelection();
                    setTableSelectedItem(selected ?? []);
                    if (onSelectionChange) {
                        onSelectionChange(selected ?? [])
                    }
                }
                prevSelectionIndices.current = currentIndices
            }
    }));
    const _handleChipRemove = (key: string): void => {
        const keyColumnName = filterChipDetails.filterChipKeyColumnName

        const currentItem = tableSelectedItemRef.current.find(c => c[`${keyColumnName}`] === key)
        const indexInItems = tableSelectedItemRef.current.findIndex(c => c[`${keyColumnName}`] === key)
        const selectionKeyIndex = filterSelectionRef.current.getSelectedIndices()[indexInItems]
        const itemKey = filterSelectionRef.current.getKey(currentItem, selectionKeyIndex)
        filterSelectionRef.current.setKeySelected(itemKey, false, false);
        if (filterChipDetails.onFilterChipRemove)
        {
            filterChipDetails.onFilterChipRemove(currentItem);
        }

    }

    useEffect(() => {
        if (lazyLoadDetails.enableLazyLoad && lazyLoadDetails.onLazyLoadTriggered) {
            observer.current = new IntersectionObserver(async (entries) => {
                const entry = entries[0];
                if (entry.isIntersecting) {
                    if (observer.current && lazyLoadRef.current) {
                        observer.current.unobserve(lazyLoadRef.current);
                    }
                    await lazyLoadDetails.onLazyLoadTriggered();
                }
            });
        }
    }, [lazyLoadRef.current]);

    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _handleRenderRow = (props, defaultRenderer): any => {

        const isLastRow = props.itemIndex === items.length - 1;

        if (onRenderRow) {
            return <>
                {onRenderRow(props, defaultRenderer)}
                {lazyLoadDetails.enableLazyLoad && isLastRow &&
                    renderLazyLoadRow()
                }
            </>
        } else if (defaultRenderer) {
            return <>
                {defaultRenderer(props)}
                {lazyLoadDetails.enableLazyLoad && isLastRow &&
                    renderLazyLoadRow()
                }
            </>
        } else {
            return null;
        }
    }
  const rowClass = CheckboxVisibility.always === checkboxVisible ? "" : styles.disableRowStyle
  const filterCount = filter(columns, { isFiltered: true }) ?? []
  const stickyHeaderStyle: IStyleFunctionOrObject<IDetailsListStyleProps, IDetailsListStyles> = {
    root: { maxHeight: 450},
    headerWrapper: {
      position: 'sticky',
      top: 0,
      zIndex: 1,

    },
  }

  if(stickyHeaderDetails?.enableStickyHeader && stickyHeaderDetails?.maxHeight)
  {
    stickyHeaderStyle.root = { maxHeight: stickyHeaderDetails.maxHeight}
  }

  return (
    <div className={classNames([styles.CustomDetailsList, rowClass, className], {[styles.isLazyLoading]: lazyLoadDetails.enableLazyLoad && lazyLoadDetails.isLoading})}>
        <div className={styles.listHeader}>
            {filterChipDetails && tableSelectedItemRef.current?.length > 0 &&
                <Stack horizontal={true} className={styles.filterClipContainer} >
                    {tableSelectedItemRef.current.map((itm) => {
                        const filterValue: IFilterChipValue = {
                            key: itm[`${filterChipDetails.filterChipKeyColumnName}`],
                            value: itm[`${filterChipDetails.filterChipColumnName}`]
                        }
                        return <FilterChip key={filterValue.key} filterValue={filterValue} onRemove={_handleChipRemove} />
                    })}
                </Stack>
            }
            {isFilterAddedToColumns &&

                <button type="button" className={styles.clearFiltersButton} disabled={!some(columns, { isFiltered: true })} onClick={_clearAllFilters}>
                    <Icon iconName='ClearFilter' />
                    <span>Clear Filters{filterCount.length > 0 ? ` (${filterCount.length})` : ""}</span>
                </button>
            }
        </div>
        <DetailsList
            columns={columns}
            checkboxVisibility={checkboxVisible}
            selection={filterSelectionRef.current}
            items={finalItemsRef.current}
            onRenderItemColumn={onRenderItemColumn}
            onRenderDetailsHeader={onRenderDetailsHeader}
            onRenderRow={_handleRenderRow}
            selectionMode={checkboxVisible ? SelectionMode.multiple : undefined}
            selectionPreservedOnEmptyClick={true}
            onItemInvoked={onDoubleClickRow}
            styles={lazyLoadDetails.enableLazyLoad || stickyHeaderDetails?.enableStickyHeader ? stickyHeaderStyle : {}}
            onShouldVirtualize={()=>false}
        />
        {lazyLoadDetails.enableLazyLoad && finalItemsRef.current.length === 0 &&
            renderLazyLoadRow(false)
        }
      {columnContextMenuProps && <ContextualMenu {...columnContextMenuProps} />}
    </div>
  )
}

const _defaultRenderItemColumn = (item?, index?: number, column?: IColumn): JSX.Element => {

    const columnType = column.data.columnType
    const colValue = item[column.fieldName]
    switch(columnType)
    {
        case DetailsListColumnType.Image:
            return <img src={colValue} width={60} height={60} />
        case DetailsListColumnType.Date:
            return <>{colValue && format(colValue, column.data.dateFormat)}</>
        case DetailsListColumnType.Time:
            return <>{colValue && format(colValue, column.data.timeFormat)}</>
        default: return <span>{colValue}</span>
    }

}

CustomDetailsList.defaultProps = {
  checkboxVisible: CheckboxVisibility.hidden,
  onRenderItemColumn: _defaultRenderItemColumn,
  enableFilter: true,
  dateFormat: "MM/dd/yyyy",
  timeFormat: "hh:mm aa",
  lazyLoadDetails: {
    enableLazyLoad: false,
    onLazyLoadTriggered: undefined,
    isLoading: false,
    moreItems: false
  }
}

export default CustomDetailsList;
