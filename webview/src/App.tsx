import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { AppProviders } from './contexts';
import { ChatPanel, Settings, SwitchAccount } from './components';
import { AccountUsageModal } from './components/AccountUsageModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useRouter, isSettingsRoute, isSwitchAccountRoute } from './router';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { OPEN_ACCOUNT_USAGE_EVENT } from './commandPalette/sections/model/AccountUsageItem';

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
      {isSettingsRoute(route) ? <Settings /> : isSwitchAccountRoute(route) ? <SwitchAccount /> : <ChatPanel />}
      {isAccountUsageOpen && (
        <AccountUsageModal onClose={() => setIsAccountUsageOpen(false)} />
      )}
      <Toaster />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <AppContent />
      </AppProviders>
    </ErrorBoundary>
  );
}

export default App;
