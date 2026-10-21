import { Link, useLocation } from 'react-router-dom'
import Wordmark from '../components/Wordmark'
import { NotFound } from '../components/NotFound'
import useDocumentMeta from '../useDocumentMeta'

// Any URL the router doesn't know. The server answers these with a 404
// status too, so they never get indexed.
export default function NotFoundPage() {
  useDocumentMeta({ title: 'Page not found · Axonis', path: '/', noindex: true })
  const { pathname } = useLocation()
  return (
    <div className="project-page">
      <header className="topbar">
        <Link to="/" className="crumb-brand" aria-label="Axonis home"><Wordmark /></Link>
      </header>
      <main id="main" className="full-center">
        <NotFound
          title="Nothing is mapped here"
          message="No page or map lives at this address. The link may be mistyped, or what it pointed to was removed."
          path={pathname}
        />
      </main>
    </div>
  )
}
