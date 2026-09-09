import { useState, useCallback } from "react";

export function useSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  return {
    isCollapsed,
    toggleSidebar,
  };
}