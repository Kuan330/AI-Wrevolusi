import { createContext, useContext } from "react";
export type MarkdownSelection = { element: HTMLInputElement | HTMLTextAreaElement; text: string; start: number; end: number; commit: (value: string) => void };
export const MarkdownContext = createContext<(selection: MarkdownSelection | null) => void>(() => undefined);
export const useMarkdownSelection = () => useContext(MarkdownContext);
