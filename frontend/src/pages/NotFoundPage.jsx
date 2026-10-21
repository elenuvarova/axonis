import { Link } from 'react-router-dom'
import Wordmark from '../components/Wordmark'
import { StateScreen } from '../components/states'
import useDocumentMeta from '../useDocumentMeta'

// Any URL the router doesn't know. The server answers these with a 404
// status too, so they never get indexed.
export default function NotFoundPage() {
  useDocumentMeta({ title: 'Page not found · Axonis', path: '/', noindex: true })
  return (
    <div className="project-page">
      <header className="topbar">
        <Link to="/" className="crumb-brand" aria-label="Axonis home"><Wordmark /></Link>
      </header>
      <main id="main" className="full-center">
        <StateScreen
          variant="empty"
          title="Page not found"
          message="There's nothing at this address. Open a demo map or build your own from the home page."
          actions={<>
            <Link className="btn btn-primary" to="/project/07796417-cbc2-464e-9185-8b1cf1645ee6">Open a demo map</Link>
            <Link className="btn btn-secondary" to="/">Go home</Link>
          </>}
        />
      </main>
    </div>
  )
}
