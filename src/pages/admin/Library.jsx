import { Link, useSearchParams } from 'react-router'
import { libraryChallenges } from '../../api/admin'
import ErrorBanner from '../../components/ErrorBanner'
import LoadMore from '../../components/LoadMore'
import { usePagedList } from '../../hooks/usePagedList'
import { formatTs } from '../../lib/timestamps'
import { ADMIN_PATHS, linkTo } from '../../routes'
import { useCategories } from './useCategories'

// A2: the challenge library by ID (CTFM407), filtered on category
export default function Library() {
  const [params, setParams] = useSearchParams()
  const category = params.get('category') ?? ''
  const categories = useCategories()
  const list = usePagedList(libraryChallenges, category ? { category_filter: category } : {})
  const nameOf = (key) => categories.find((c) => c.tabKey === key)?.tabValue || key

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-3">
        <h1 className="text-[17px] font-medium">Library</h1>
        <div className="flex flex-col gap-1 text-[13px]">
          <label htmlFor="category-filter" className="sr-only">Category</label>
          <select id="category-filter" className="input" value={category}
            onChange={(e) => setParams(e.target.value ? { category: e.target.value } : {}, { replace: true })}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.tabKey} value={c.tabKey}>{c.tabValue || c.tabKey}</option>)}
          </select>
        </div>
        <Link className="btn-primary ml-auto" to={ADMIN_PATHS.challenge}>
          <i className="ti ti-plus" aria-hidden="true" />
          New challenge
        </Link>
      </header>

      {list.error && <ErrorBanner error={list.error} onRetry={list.reload} />}
      {!list.loading && !list.error && list.rows.length === 0 && (
        <p className="card p-6 text-fg-2">{category ? 'No challenges in this category.' : 'The library is empty. Start with "New challenge".'}</p>
      )}
      {list.rows.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="w-12">ID</th>
                <th>Challenge</th>
                <th>Category</th>
                <th>Changed</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((c) => (
                <tr key={c.challengeID}>
                  <td className="tabular-nums text-fg-3">{c.challengeID}</td>
                  <td>
                    <Link className="font-medium hover:underline" to={linkTo(ADMIN_PATHS.challenge, { challengeID: c.challengeID })}>
                      {c.challengeTitle}
                    </Link>
                  </td>
                  <td>{nameOf(c.category)}</td>
                  <td className="whitespace-nowrap text-[12px] text-fg-3">
                    {c.updatedDate ? `${formatTs(c.updatedDate)} · ${c.updatedBy}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LoadMore list={list} label="Next 20" />
    </section>
  )
}
