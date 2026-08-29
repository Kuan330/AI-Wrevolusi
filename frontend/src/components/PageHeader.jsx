export function PageHeader({ kicker, title, lead }) {
  return (
    <>
      {kicker ? <p className="kicker">{kicker}</p> : null}
      <h1>{title}</h1>
      {lead ? <p className="lead">{lead}</p> : null}
    </>
  );
}
