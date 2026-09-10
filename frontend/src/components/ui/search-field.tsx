import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "./form-field";
type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label: string;
};
export function SearchField(props: Props) {
  const { value, onChange, placeholder, label } = props;
  const [draft, setDraft] = useState(value);
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);
  const [previousValue, setPreviousValue] = useState(value);
  if (previousValue !== value) {
    setPreviousValue(value);
    setDraft(value);
  }
  useEffect(() => {
    if (draft === value) return;
    const timer = window.setTimeout(() => callback.current(draft), 250);
    return () => window.clearTimeout(timer);
  }, [draft, value]);
  return (
    <form
      className="relative min-w-0 flex-1"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onChange(draft);
      }}
    >
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="h-12 rounded-2xl bg-white pr-14 shadow-none"
      />
      <button
        type="submit"
        aria-label="Search"
        className="absolute inset-y-0 right-1 flex w-11 items-center justify-center rounded-xl text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Search size={20} aria-hidden="true" />
      </button>
    </form>
  );
}
