"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface ProjectInfo {
  name: string;
  onEdit: () => void;
  onImport: () => void;
  onDownload: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

interface HeaderContextType {
  projectInfo: ProjectInfo | null;
  setProjectInfo: (info: ProjectInfo | null) => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);

  return (
    <HeaderContext.Provider value={{ projectInfo, setProjectInfo }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const context = useContext(HeaderContext);
  if (context === undefined) {
    throw new Error("useHeader must be used within a HeaderProvider");
  }
  return context;
}
