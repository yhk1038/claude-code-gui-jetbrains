import { AppProviders } from './contexts';
import { ChatPanel } from './components';

function App() {
  return (
    <AppProviders>
      <ChatPanel />
    </AppProviders>
  );
}

export default App;
