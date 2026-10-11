import Icon from './icons'

// Small "?" icon button that (re)launches the guided tour.
// `size="sm"` matches the compact project-header controls.
export default function HelpButton({ onClick, label = 'Take a tour', className = '', size, text }) {
  return (
    <button
      type="button"
      className={`icon-btn${size === 'sm' ? ' icon-btn-sm' : ''}${text ? ' icon-btn-text' : ''} ${className}`.trim()}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Icon name="help" />
      {text && <span>{text}</span>}
    </button>
  )
}
