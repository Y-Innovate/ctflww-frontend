import { refTables } from '../../api/admin'
import ErrorBanner from '../../components/ErrorBanner'
import { useFullList } from '../../hooks/useFullList'
import RefTableSection from './settings/RefTableSection'

// The reference tables the programs know, in this order; other table IDs
// follow under their own name.
const KNOWN = [
  {
    tableID: 'CATEGORY',
    title: 'Challenge categories',
    note: 'The key goes with each challenge; players see the name. A category that a challenge uses can\'t be deleted.',
    canAdd: true,
    valueLabel: 'Name',
  },
  {
    tableID: 'RACFGRP',
    title: 'Allowed RACF groups',
    note: 'The groups an event may put its players in. A new group also needs CONNECT authority for the batch userid (see RACF.jcl). A group that an event uses can\'t be deleted.',
    canAdd: true,
    valueLabel: 'Description',
  },
  {
    tableID: 'SETTINGS',
    title: 'Settings',
    note: 'Used by the provisioning jobs and the batch programs, which need every key. A value must fit the field the programs read it into; CLAIMHRS and JOBMINS are numbers.',
    canAdd: false,
    valueLabel: 'Value',
    settings: true,
  },
]

// A1, A2: the reference tables (TBCTF001)
export default function Settings() {
  const list = useFullList(refTables, {})
  const known = new Set(KNOWN.map((t) => t.tableID))
  const others = [...new Set(list.rows.map((r) => r.tableID))].filter((id) => !known.has(id))
  const rowsOf = (tableID) => list.rows.filter((r) => r.tableID === tableID)

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-[17px] font-medium">Settings</h1>
      {list.error && <ErrorBanner error={list.error} onRetry={list.reload} />}
      {list.loaded && (
        <>
          {KNOWN.map((t) => (
            <RefTableSection key={t.tableID} table={t} rows={rowsOf(t.tableID)} onChange={list.reload} />
          ))}
          {others.map((id) => (
            <RefTableSection
              key={id}
              table={{ tableID: id, title: id, note: 'A table the programs don\'t use.', canAdd: false, valueLabel: 'Value' }}
              rows={rowsOf(id)}
              onChange={list.reload}
            />
          ))}
        </>
      )}
    </section>
  )
}
