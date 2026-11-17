/**
 * Titre « file-scan » en ASCII art (police figlet « ANSI Shadow », comme le nom du portfolio).
 * Dessin précalculé : aucune dépendance ni coût au chargement.
 * Pour le régénérer : npx figlet -f "ANSI Shadow" FILE-SCAN
 */
const ART = [
  '███████╗██╗██╗     ███████╗    ███████╗ ██████╗ █████╗ ███╗   ██╗',
  '██╔════╝██║██║     ██╔════╝    ██╔════╝██╔════╝██╔══██╗████╗  ██║',
  '█████╗  ██║██║     █████╗█████╗███████╗██║     ███████║██╔██╗ ██║',
  '██╔══╝  ██║██║     ██╔══╝╚════╝╚════██║██║     ██╔══██║██║╚██╗██║',
  '██║     ██║███████╗███████╗    ███████║╚██████╗██║  ██║██║ ╚████║',
  '╚═╝     ╚═╝╚══════╝╚══════╝    ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝',
]

type Kind = 'block' | 'shadow' | 'space'

const kindOf = (ch: string): Kind => (ch === '█' ? 'block' : ch === ' ' ? 'space' : 'shadow')

/** Regroupe les caractères consécutifs de même type : quelques spans par ligne au lieu d'un par caractère. */
function runs(line: string): { kind: Kind; text: string }[] {
  const out: { kind: Kind; text: string }[] = []
  for (const ch of line) {
    const kind = kindOf(ch)
    const last = out[out.length - 1]
    if (last && last.kind === kind) last.text += ch
    else out.push({ kind, text: ch })
  }
  return out
}

export default function AsciiTitle() {
  return (
    <h1 className="ascii-title">
      {/* Clic sur le titre : recharge la page (navigation vers l'accueil de l'appli). */}
      <a href={import.meta.env.BASE_URL} className="ascii-title__link" title="Recharger la page">
        <span className="sr-only">file-scan</span>
        <pre className="ascii-title__art" aria-hidden="true">
        {ART.map((line, y) => (
          <span key={y} className="ascii-title__line">
            {runs(line).map((r, i) =>
              r.kind === 'space' ? r.text : (
                <span key={i} className={r.kind === 'block' ? 'ascii-title__b' : 'ascii-title__s'}>
                  {r.text}
                </span>
              ),
            )}
            {'\n'}
          </span>
        ))}
        </pre>
      </a>
    </h1>
  )
}
