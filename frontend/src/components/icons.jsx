// UI icons: Streamline Sharp Line (https://streamlinehq.com, Icons plan licence).
// Square geometry and flat ends to match B²'s zero radius. Strokes use
// non-scaling-stroke so they stay a crisp 1px line at any rendered size,
// like the rest of the interface's hairlines.
const paths = {
  warning: ['M12 2.086 22.317 21H1.683L12 2.086Z', 'M12 8.5v6', 'M12 16.5v2'],
  search: ['M1 11a10 10 0 1 0 20 0 10 10 0 1 0-20 0Z', 'm18 18 5 5'],
  close: ['M22 2 2 22', 'm2 2 20 20'],
  help: ['M2 2h20v20H2z', 'M8.5 10v-.5a3.5 3.5 0 0 1 7 0v.5L12 13v2.5', 'm12 17 0 2'],
  upload: ['M16.5 15.5 12 11l-4.5 4.5', 'm12 11 0 13', 'M8 19H3V5.5m18 0V19h-5', 'M3 5h18', 'M3 5.5v-.75L6 1h12l3 3.75v.75', 'M12 5V1'],
  brief: ['M7 6.5h5', 'M7 12h10', 'M7 17.5h10', 'M16 1H3v22h18V6l-5-5Z'],
}

export default function Icon({ name, size = 18, strokeWidth = 1, className }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      className={className} aria-hidden="true" focusable="false"
    >
      {paths[name].map((d) => <path key={d} d={d} vectorEffect="non-scaling-stroke" />)}
    </svg>
  )
}
