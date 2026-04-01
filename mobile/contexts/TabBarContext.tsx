/**
 * TabBarContext - Controls tab bar visibility
 * Used to hide the tab bar when viewing full-screen content like chat conversations
 */

import React, { createContext, useContext, useState, useCallback } from "react";

interface TabBarContextType {
  isVisible: boolean;
  hideTabBar: () => void;
  showTabBar: () => void;
}

const TabBarContext = createContext<TabBarContextType>({
  isVisible: true,
  hideTabBar: () => {},
  showTabBar: () => {},
});

export function TabBarProvider({ children }: { children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(true);

  const hideTabBar = useCallback(() => {
    setIsVisible(false);
  }, []);

  const showTabBar = useCallback(() => {
    setIsVisible(true);
  }, []);

  return (
    <TabBarContext.Provider value={{ isVisible, hideTabBar, showTabBar }}>
      {children}
    </TabBarContext.Provider>
  );
}

export function useTabBar() {
  return useContext(TabBarContext);
}

export default TabBarContext;
