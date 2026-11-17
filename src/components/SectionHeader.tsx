/** En-tête de section façon portfolio : petit index mono violet (« 01 ») puis le titre. */
export default function SectionHeader({ index, title, id }: { index: string; title: string; id?: string }) {
  return (
    <div className="section-head">
      <span className="section-head__index" aria-hidden="true">
        {index}
      </span>
      <h2 className="section-head__title" id={id}>
        {title}
      </h2>
    </div>
  )
}
