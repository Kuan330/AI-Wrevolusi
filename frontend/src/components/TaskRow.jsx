export function TaskRow({ title, meta, badges, actions }) {
  return (
    <article className="row">
      <div>
        {badges}
        <h3>{title}</h3>
        {meta ? <p className="meta">{meta}</p> : null}
      </div>
      {actions ? <div className="row-actions">{actions}</div> : null}
    </article>
  );
}
