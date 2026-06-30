import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppProviders } from './contexts';
import { ChatPage, SettingsPage, SettingsOverlay, SwitchAccountPage, ProjectSelectorPage, SessionPanelPage } from './pages';
import { AccountUsageModal } from './components/AccountUsageModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { OPEN_ACCOUNT_USAGE_EVENT } from './commandPalette/sections/model/AccountUsageItem';
import { isDev } from './config/environment';
import 'katex/dist/katex.min.css';

function AppContent() {
  useKeyboardShortcuts();
  const [isAccountUsageOpen, setIsAccountUsageOpen] = useState(false);
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation;

  useEffect(() => {
    const handler = () => setIsAccountUsageOpen(true);
    window.addEventListener(OPEN_ACCOUNT_USAGE_EVENT, handler);
    return () => window.removeEventListener(OPEN_ACCOUNT_USAGE_EVENT, handler);
  }, []);

  return (
    <>
      {isDev() && <div className="sticky top-0 border-t-2 border-t-fuchsia-500 z-50" />}
      <Routes location={backgroundLocation ?? location}>
        <Route path="/" element={<ProjectSelectorPage />} />
        <Route path="/sessions/new" element={<ChatPage />} />
        <Route path="/sessions/:current_session_id" element={<ChatPage />} />
        <Route path="/session-panel" element={<SessionPanelPage />} />
        <Route path="/settings" element={<Navigate to="/settings/general" replace />} />
        <Route path="/settings/*" element={<SettingsPage />} />
        <Route path="/switch-account" element={<SwitchAccountPage />} />
        <Route path="*" element={<Navigate to="/sessions/new" replace />} />
      </Routes>

      {backgroundLocation && (
        <SettingsOverlay>
          <Routes>
            <Route path="/settings/*" element={<SettingsPage />} />
          </Routes>
        </SettingsOverlay>
      )}

      {isAccountUsageOpen && (
        <AccountUsageModal onClose={() => setIsAccountUsageOpen(false)} />
      )}
      <Toaster
        position="top-center"
        containerStyle={{ top: 40 }}
        toastOptions={{
          style: {
            background: 'var(--surface-raised)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            fontSize: '0.8461rem',
            padding: '8px 12px',
          },
          success: {
            iconTheme: {
              primary: 'var(--state-success-fg)',
              secondary: 'var(--surface-raised)',
            },
          },
        }}
      />
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
