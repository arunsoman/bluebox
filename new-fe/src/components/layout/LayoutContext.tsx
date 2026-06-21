import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface LayoutConfig {
  headerCenter?: ReactNode;
  headerRight?: ReactNode;
  footerLeft?: ReactNode;
  footerCenter?: ReactNode;
  footerRight?: ReactNode;
}

const LayoutContext = createContext<{
  config: LayoutConfig;
  setConfig: (c: LayoutConfig) => void;
}>({ config: {}, setConfig: () => {} });

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<LayoutConfig>({});
  const setConfig = useCallback((c: LayoutConfig) => setConfigState(c), []);
  return (
    <LayoutContext.Provider value={{ config, setConfig }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  return useContext(LayoutContext);
}