import { createContext, useContext } from "react";
export const WorkspacePresentation = createContext({
  setEditorActive: (_active: boolean) => {}, toggleMenu: () => {}, menuOpen: false,
});
export const useWorkspacePresentation = () => useContext(WorkspacePresentation);
