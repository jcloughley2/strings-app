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

// Simple page info for pages like Registry that just need a breadcrumb title
interface PageInfo {
  name: string;
}

// Focus mode info for viewing a single string
interface FocusInfo {
  parentName: string;  // Project name or "Registry"
  parentPath: string;  // Link to parent (e.g., "/projects/123" or "/registry")
  stringName: string;  // Display name or variable hash
}

interface HeaderContextType {
  projectInfo: ProjectInfo | null;
  setProjectInfo: (info: ProjectInfo | null) => void;
  pageInfo: PageInfo | null;
  setPageInfo: (info: PageInfo | null) => void;
  focusInfo: FocusInfo | null;
  setFocusInfo: (info: FocusInfo | null) => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [focusInfo, setFocusInfo] = useState<FocusInfo | null>(null);

  return (
    <HeaderContext.Provider value={{ 
      projectInfo, setProjectInfo, 
      pageInfo, setPageInfo,
      focusInfo, setFocusInfo 
    }}>
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
