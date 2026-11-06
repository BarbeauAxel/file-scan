import { useMemo } from 'react'

type TokenKind = 'key' | 'string' | 'number' | 'boolean' | 'null' | 'punct'

const TOKEN_CLASSES: Record<TokenKind, string> = {
  key: 'text-sky-300',
  string: 'text-emerald-300',
  number: 'text-amber-300',
  boolean: 'text-fuchsia-300',
  null: 'text-slate-400 italic',
  punct: 'text-slate-400',
}

// Chaînes (éventuellement suivies de « : » pour une clé), nombres, littéraux, ponctuation.
const TOKEN_RE = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\b(null)\b|([{}[\],])/g

/** Découpe un JSON indenté en jetons colorés, sans innerHTML. */
function tokenize(json: string): { text: string; kind?: TokenKind }[] {
  const out: { text: string; kind?: TokenKind }[] = []
  let last = 0
  for (const m of json.matchAll(TOKEN_RE)) {
    const index = m.index ?? 0
    if (index > last) out.push({ text: json.slice(last, index) })
    if (m[1] !== undefined) {
      out.push({ text: m[1], kind: m[2] ? 'key' : 'string' })
      if (m[2]) out.push({ text: m[2], kind: 'punct' })
    } else if (m[3] !== undefined) out.push({ text: m[3], kind: 'number' })
    else if (m[4] !== undefined) out.push({ text: m[4], kind: 'boolean' })
    else if (m[5] !== undefined) out.push({ text: m[5], kind: 'null' })
    else out.push({ text: m[6], kind: 'punct' })
    last = index + m[0].length
  }
  if (last < json.length) out.push({ text: json.slice(last) })
  return out
}

export default function JsonViewer({ json }: { json: string }) {
  const tokens = useMemo(() => tokenize(json), [json])
  return (
    <pre className="max-h-[32rem] overflow-auto rounded-lg bg-slate-900 p-4 text-sm leading-relaxed text-slate-100">
      <code data-testid="json-output">
        {tokens.map((t, i) =>
          t.kind ? (
            <span key={i} className={TOKEN_CLASSES[t.kind]}>
              {t.text}
            </span>
          ) : (
            t.text
          ),
        )}
      </code>
    </pre>
  )
}
