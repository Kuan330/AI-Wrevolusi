export function Toast({ message }) {
  if (!message) return <div className="toast" />;
  return <div className={`toast show`}>{message}</div>;
}
