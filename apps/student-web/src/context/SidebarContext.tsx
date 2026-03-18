import { createContext, useContext, useState, ReactNode } from 'react';

interface SidebarContextType {
  customSidebar: ReactNode | null;
  setCustomSidebar: (content: ReactNode | null) => void;
}

const SidebarContext = createContext<SidebarContextType | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [customSidebar, setCustomSidebar] = useState<ReactNode | null>(null);

  return (
    <SidebarContext.Provider value={{ customSidebar, setCustomSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
