import { useState } from 'react'

// Copies `text` to the clipboard; says so for two seconds
export default function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }
  return (
    <button type="button" className="btn-secondary" onClick={copy}>
      <i className={`ti ${copied ? 'ti-check' : 'ti-copy'}`} aria-hidden="true" />
      {copied ? 'Copied' : label}
    </button>
  )
}
