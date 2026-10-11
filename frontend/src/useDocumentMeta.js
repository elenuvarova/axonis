import { useEffect } from 'react'

// Per-route <title>, description, canonical and og:url/og:title. index.html
// carries the home values for crawlers that don't run JS; this keeps a map's
// own URL from being canonicalised to the home page once it renders.
const ORIGIN = 'https://axonis.app'

function setMeta(selector, attr, value) {
  const el = document.head.querySelector(selector)
  if (el) el.setAttribute(attr, value)
}

export default function useDocumentMeta({ title, description, path }) {
  useEffect(() => {
    if (!title) return
    document.title = title
    if (description) {
      setMeta('meta[name="description"]', 'content', description)
      setMeta('meta[property="og:description"]', 'content', description)
    }
    setMeta('meta[property="og:title"]', 'content', title)
    setMeta('meta[name="twitter:title"]', 'content', title)
    const url = ORIGIN + (path || '/')
    setMeta('link[rel="canonical"]', 'href', url)
    setMeta('meta[property="og:url"]', 'content', url)
  }, [title, description, path])
}
