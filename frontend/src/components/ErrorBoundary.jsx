import { Component } from 'react'
import Icon from './icons'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Surface in the console for debugging; no external logging in this MVP.
    console.error('Uncaught UI error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="full-center" style={{ minHeight: '100vh' }}>
          <div className="state-screen">
            <div className="state-icon is-error">
              <Icon name="warning" size={24} />
            </div>
            <div className="state-title">Something went wrong</div>
            <p className="state-message">The interface hit an unexpected error. Reloading usually fixes it.</p>
            <div className="state-actions">
              <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
              <a className="btn btn-secondary" href="/">Go home</a>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
