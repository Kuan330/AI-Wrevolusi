export function Button({ variant = "primary", small = false, className = "", ...props }) {
  const cls = ["btn", `btn-${variant}`, small ? "small" : "", className].filter(Boolean).join(" ");
  return <button className={cls} {...props} />;
}
