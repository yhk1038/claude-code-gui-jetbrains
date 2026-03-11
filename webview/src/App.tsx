import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppProviders } from './contexts';
import { ChatPanel, Settings, SwitchAccount } from './components';
import { ProjectSelector } from './components/ProjectSelector';
import { AccountUsageModal } from './components/AccountUsageModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { OPEN_ACCOUNT_USAGE_EVENT } from './commandPalette/sections/model/AccountUsageItem';

function AppContent() {
  useKeyboardShortcuts();
  const [isAccountUsageOpen, setIsAccountUsageOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsAccountUsageOpen(true);
    window.addEventListener(OPEN_ACCOUNT_USAGE_EVENT, handler);
    return () => window.removeEventListener(OPEN_ACCOUNT_USAGE_EVENT, handler);
  }, []);

  return (
    <>
      <Routes>
        <Route path="/" element={<ProjectSelector />} />
        <Route path="/sessions/new" element={<ChatPanel />} />
        <Route path="/sessions/:current_session_id" element={<ChatPanel />} />
        <Route path="/settings" element={<Navigate to="/settings/general" replace />} />
        <Route path="/settings/*" element={<Settings />} />
        <Route path="/switch-account" element={<SwitchAccount />} />
        <Route path="*" element={<Navigate to="/sessions/new" replace />} />
      </Routes>
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
