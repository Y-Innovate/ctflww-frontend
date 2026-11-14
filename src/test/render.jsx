import { render } from '@testing-library/react'
import App from '../App'

// Renders the whole app at a path under /ctf, as a page load would
export function openApp(path) {
  window.history.pushState({}, '', `/ctf${path}`)
  return render(<App />)
}
