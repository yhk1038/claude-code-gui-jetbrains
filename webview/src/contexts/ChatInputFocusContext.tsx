import { createContext, useContext, useRef, useCallback, ReactNode, RefObject } from 'react';

interface ChatInputFocusContextType {
  textareaRef: RefObject<HTMLDivElement>;
  /** Focus the ChatInput composer from anywhere */
  focus: () => void;
}

const ChatInputFocusContext = createContext<ChatInputFocusContextType>({
  textareaRef: { current: null },
  focus: () => {},
});

export function ChatInputFocusProvider({ children }: { children: ReactNode }) {
  const textareaRef = useRef<HTMLDivElement>(null);

  const focus = useCallback(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <ChatInputFocusContext.Provider value={{ textareaRef, focus }}>
      {children}
    </ChatInputFocusContext.Provider>
  );
}

export function useChatInputFocus() {
  return useContext(ChatInputFocusContext);
}
