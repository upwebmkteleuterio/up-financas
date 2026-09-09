import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

interface PageTitleContextType {
  title: string;
  subtitle: string;
  setTitle: (title: string, subtitle?: string) => void;
}

const PageTitleContext = createContext<PageTitleContextType | undefined>(undefined);

export function usePageTitle() {
  const context = useContext(PageTitleContext);
  if (context === undefined) {
    throw new Error("usePageTitle must be used within a PageTitleProvider");
  }
  return context;
}

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitleState] = useState("UpWeb");
  const [subtitle, setSubtitleState] = useState("Gestão estratégica");

  const setTitle = useCallback((newTitle: string, newSubtitle: string = "") => {
    setTitleState(newTitle);
    setSubtitleState(newSubtitle);
  }, []);

  const value = useMemo(() => ({
    title,
    subtitle,
    setTitle,
  }), [title, subtitle, setTitle]);

  return <PageTitleContext.Provider value={value}>{children}</PageTitleContext.Provider>;
}