import { createContext, useContext, type ReactNode } from 'react';

import { useHomeAssistant, type UseHomeAssistantResult } from '@/hooks/use-home-assistant';

const HomeAssistantContext = createContext<UseHomeAssistantResult | null>(null);

export function HomeAssistantProvider({ children }: { children: ReactNode }) {
  const value = useHomeAssistant();
  return <HomeAssistantContext.Provider value={value}>{children}</HomeAssistantContext.Provider>;
}

export function useHomeAssistantContext() {
  const ctx = useContext(HomeAssistantContext);
  if (!ctx) {
    throw new Error('useHomeAssistantContext must be used within a HomeAssistantProvider');
  }
  return ctx;
}
