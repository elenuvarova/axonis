import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ProjectPage from './pages/ProjectPage'
import NotFoundPage from './pages/NotFoundPage'
import ErrorBoundary from './components/ErrorBoundary'
import ConsentBar from './components/ConsentBar'
import './styles.css'
import './ux.css'
import './nng.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, retry: 1 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <div className="app">
            {/* First in tab order: jump past the top bar (WCAG 2.4.1). */}
            <a className="skip-link" href="#main">Skip to content</a>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/project/:id" element={<ProjectPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            <ConsentBar />
          </div>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
