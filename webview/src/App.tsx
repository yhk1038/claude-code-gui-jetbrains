import { useState, useEffect } from 'react';
import { AppProviders } from './contexts';
import { ChatPanel, Settings } from './components';
import { AccountUsageModal } from './components/AccountUsageModal';
import { useRouter, isSettingsRoute } from './router';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { OPEN_ACCOUNT_USAGE_EVENT } from './commandPalette/sections/model/items';

function AppContent() {
  useKeyboardShortcuts();
  const { route } = useRouter();
  const [isAccountUsageOpen, setIsAccountUsageOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsAccountUsageOpen(true);
    window.addEventListener(OPEN_ACCOUNT_USAGE_EVENT, handler);
    return () => window.removeEventListener(OPEN_ACCOUNT_USAGE_EVENT, handler);
  }, []);

  return (
    <>
      {isSettingsRoute(route) ? <Settings /> : <ChatPanel />}
      {isAccountUsageOpen && (
        <AccountUsageModal onClose={() => setIsAccountUsageOpen(false)} />
      )}
    </>
  );
}

function App() {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}

export default App;
