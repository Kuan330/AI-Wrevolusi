export function contactError(name: string, value: string): string {
  if (!value.trim()) return "";
  if (name === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return "Enter a valid email address, for example name@example.com.";
  if (name === "phone" && (!/^\+?[0-9 ()-]+$/.test(value.trim()) || value.replace(/\D/g, "").length < 7 || value.replace(/\D/g, "").length > 15)) return "Enter 7–15 digits. A leading +, spaces, parentheses and hyphens are allowed.";
  return "";
}
