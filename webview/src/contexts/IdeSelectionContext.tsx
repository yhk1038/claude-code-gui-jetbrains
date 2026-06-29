import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useIdeSelection, IdeSelectionPayload } from '@/hooks/useIdeSelection';
import { useSessionContext } from './SessionContext';

interface IdeSelectionContextType {
  /** The latest IDE selection for the current working dir, or null. */
  currentSelection: IdeSelectionPayload | null;
  /** Whether the next send should prepend the IDE-context tag. Defaults true. */
  includeSelection: boolean;
  /** Flip the include flag (chip click). */
  toggleIncludeSelection: () => void;
}

const IdeSelectionContext = createContext<IdeSelectionContextType>({
  currentSelection: null,
  includeSelection: true,
  toggleIncludeSelection: () => {},
});

export function useIdeSelectionContext() {
  return useContext(IdeSelectionContext);
}

interface Props {
  children: ReactNode;
  /**
   * Shared refs handed down from ChatProviderBridge so the sibling
   * ChatStreamProvider can read the live selection / toggle inside its stable
   * sendMessage callback WITHOUT subscribing to this context (which re-renders
   * on every IDE selection change). Mirrors the inputRef pattern.
   */
  currentSelectionRef?: React.MutableRefObject<IdeSelectionPayload | null>;
  includeSelectionRef?: React.MutableRefObject<boolean>;
}

/**
 * Owns the IDE-context state used by the composer chip and by message
 * injection:
 *  - currentSelection: latest IDE_SELECTION push for this working dir.
 *  - includeSelection: user toggle (eye / eye-off), default on.
 *
 * State lives here (not in ChatStreamProvider) so the chip can re-render on
 * selection changes, while the live values are also mirrored into refs so the
 * outer ChatStreamProvider reads them without re-rendering its consumers.
 */
export function IdeSelectionProvider(props: Props) {
  const { children, currentSelectionRef, includeSelectionRef } = props;
  const { workingDirectory } = useSessionContext();
  const { currentSelection } = useIdeSelection({ currentWorkingDir: workingDirectory ?? '' });
  const [includeSelection, setIncludeSelection] = useState(true);

  const toggleIncludeSelection = useCallback(() => {
    setIncludeSelection((prev) => !prev);
  }, []);

  // Mirror live values into the shared refs (effect, not during render).
  useEffect(() => {
    if (currentSelectionRef) currentSelectionRef.current = currentSelection;
  }, [currentSelection, currentSelectionRef]);

  useEffect(() => {
    if (includeSelectionRef) includeSelectionRef.current = includeSelection;
  }, [includeSelection, includeSelectionRef]);

  return (
    <IdeSelectionContext.Provider
      value={{ currentSelection, includeSelection, toggleIncludeSelection }}
    >
      {children}
    </IdeSelectionContext.Provider>
  );
}
