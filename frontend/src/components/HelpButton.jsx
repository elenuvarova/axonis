import Icon from './icons'

// Small "?" icon button that (re)launches the guided tour.
// `size="sm"` matches the compact project-header controls.
export default function HelpButton({ onClick, label = 'Take a tour', className = '', size }) {
  return (
    <button
      type="button"
      className={`icon-btn${size === 'sm' ? ' icon-btn-sm' : ''} ${className}`.trim()}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Icon name="help" />
    </button>
  )
}
