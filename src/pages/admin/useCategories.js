import { refTables } from '../../api/admin'
import { useFullList } from '../../hooks/useFullList'

// The categories (CATEGORY reference table) for filters and forms:
// [{ tabKey, tabValue }]
export function useCategories() {
  return useFullList(refTables, { tableID_filter: 'CATEGORY' }).rows.filter((r) => r.tableID === 'CATEGORY')
}
