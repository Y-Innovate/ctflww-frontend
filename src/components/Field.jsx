// A labelled form field with an optional hint and error; extra props go to
// the input
export default function Field({ label, hint, error, id, ...input }) {
  const inputId = id ?? input.name
  return (
    <div className="flex flex-col gap-1 text-[13px]">
      <label htmlFor={inputId}>{label}</label>
      <input id={inputId} className={`input ${error ? 'border-danger-fg' : ''}`} aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${inputId}-note` : undefined} {...input} />
      {(error || hint) && (
        <span id={`${inputId}-note`} className={`text-[12px] ${error ? 'text-danger-fg' : 'text-fg-3'}`}>{error || hint}</span>
      )}
    </div>
  )
}
