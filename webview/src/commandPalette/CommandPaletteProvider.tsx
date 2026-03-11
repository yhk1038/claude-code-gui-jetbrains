import { createContext, useContext, useMemo, useRef, useState, useEffect, useCallback, ReactNode } from 'react';
import { useChatStreamContext } from '@/contexts/ChatStreamContext';
import { useSessionContext } from '@/contexts/SessionContext';
import { useBridgeContext } from '@/contexts/BridgeContext';
import { getAdapter } from '@/adapters';
import { PanelSection, PanelSectionId } from '@/types/commandPalette';
import { CommandPaletteServices } from './types';
import { CommandPaletteRegistry } from './CommandPaletteRegistry';
import { KeyboardRegistry } from './KeyboardRegistry';
import {
  ContextSection,
  ModelSection,
  CustomizeSection,
  SlashCommandsSection,
  SettingsSection,
  SupportSection,
  ClearCommand,
  InitCommand,
  ReviewCommand,
  HelpCommand,
  CompactCommand,
  contextItems,
  modelItems,
  customizeItems,
  settingsItems,
  supportItems,
} from './sections';
import { CliPassthroughCommand } from './sections/slashCommands/CliPassthroughCommand';

interface CommandPaletteRegistryContextValue {
  registry: CommandPaletteRegistry;
  keyboardRegistry: KeyboardRegistry;
  sections: PanelSection[];
}

const CommandPaletteRegistryContext = createContext<CommandPaletteRegistryContextValue | undefined>(undefined);

export function useCommandPaletteRegistry(): CommandPaletteRegistryContextValue {
  const context = useContext(CommandPaletteRegistryContext);
  if (!context) {
    throw new Error('useCommandPaletteRegistry must be used within a CommandPaletteProvider');
  }
  return context;
}

interface CommandPaletteProviderProps {
  children: ReactNode;
}

export function CommandPaletteProvider({ children }: CommandPaletteProviderProps) {
  const chatStream = useChatStreamContext();
  const { systemInit } = chatStream;
  const session = useSessionContext();
  const bridge = useBridgeContext();

  // Services ref - always points to current React state
  const servicesRef = useRef<CommandPaletteServices>({
    chatStream: {
      messages: chatStream.messages,
      isStreaming: chatStream.isStreaming,
      isStopped: chatStream.isStopped,
      input: chatStream.input,
      setInput: chatStream.setInput,
      sendMessage: chatStream.sendMessage,
      stop: chatStream.stop,
      continue: chatStream.continue,
      clearMessages: chatStream.clearMessages,
      resetStreamState: chatStream.resetStreamState,
      resetForSessionSwitch: chatStream.resetForSessionSwitch,
    },
    session: {
      currentSessionId: session.currentSessionId,
      sessionState: session.sessionState,
      workingDirectory: session.workingDirectory,
      setCurrentSessionId: session.setCurrentSessionId,
      setSessionState: session.setSessionState,
    },
    adapter: {
      openNewTab: () => getAdapter().openNewTab(),
      openSettings: () => getAdapter().openSettings(),
      openTerminal: (workingDir) => getAdapter().openTerminal(workingDir),
    },
  });

  // Update servicesRef on every render
  servicesRef.current = {
    chatStream: {
      messages: chatStream.messages,
      isStreaming: chatStream.isStreaming,
      isStopped: chatStream.isStopped,
      input: chatStream.input,
      setInput: chatStream.setInput,
      sendMessage: chatStream.sendMessage,
      stop: chatStream.stop,
      continue: chatStream.continue,
      clearMessages: chatStream.clearMessages,
      resetStreamState: chatStream.resetStreamState,
      resetForSessionSwitch: chatStream.resetForSessionSwitch,
    },
    session: {
      currentSessionId: session.currentSessionId,
      sessionState: session.sessionState,
      workingDirectory: session.workingDirectory,
      setCurrentSessionId: session.setCurrentSessionId,
      setSessionState: session.setSessionState,
    },
    adapter: {
      openNewTab: () => getAdapter().openNewTab(),
      openSettings: () => getAdapter().openSettings(),
      openTerminal: (workingDir) => getAdapter().openTerminal(workingDir),
    },
  };

  // Create registries once
  const { registry, keyboardRegistry } = useMemo(() => {
    const reg = new CommandPaletteRegistry(servicesRef);
    const keyboardReg = new KeyboardRegistry();

    // Register sections with their commands/items
    reg.registerSection(new ContextSection(), contextItems);
    reg.registerSection(new ModelSection(), modelItems);
    reg.registerSection(new CustomizeSection(), customizeItems);
    reg.registerSection(new SlashCommandsSection(), [
      new ClearCommand(),
      new InitCommand(),
      new ReviewCommand(),
      new HelpCommand(),
      new CompactCommand(),
    ]);
    reg.registerSection(new SettingsSection(), settingsItems);
    reg.registerSection(new SupportSection(), supportItems);

    // Auto-register keyboard bindings from commands
    const bindings = reg.getKeyboardBindings();
    for (const binding of bindings) {
      keyboardReg.register({
        id: binding.id,
        match: binding.handler,
        execute: binding.execute,
      });
    }

    // Register non-command keyboard shortcuts
    keyboardReg.register({
      id: 'new-tab',
      match: (e: KeyboardEvent) => (e.metaKey || e.ctrlKey) && e.key === 'n',
      execute: async () => {
        const newTabButton = document.getElementById('new-tab-button');
        if (newTabButton) newTabButton.click();
      },
    });

    keyboardReg.register({
      id: 'open-settings',
      match: (e: KeyboardEvent) => (e.metaKey || e.ctrlKey) && e.key === ',',
      execute: async () => {
        await getAdapter().openSettings();
      },
    });

    return { registry: reg, keyboardRegistry: keyboardReg };
  }, []);

  const [fsCommandNames, setFsCommandNames] = useState<string[]>([]);

  const fetchSlashCommands = useCallback(() => {
    if (!bridge.isConnected) return;

    console.log('[CommandPaletteProvider] Sending GET_SLASH_COMMANDS, workingDir:', session.workingDirectory);
    bridge.send('GET_SLASH_COMMANDS', { workingDir: session.workingDirectory ?? undefined })
      .then((response: Record<string, unknown>) => {
        console.log('[CommandPaletteProvider] GET_SLASH_COMMANDS response:', response);
        const commands = response?.slashCommands;
        if (Array.isArray(commands)) {
          const names = commands.map((cmd: unknown) =>
            typeof cmd === 'string' ? cmd : (cmd as any)?.name ?? ''
          ).filter(Boolean);
          setFsCommandNames(names);
          console.log('[CommandPaletteProvider] Filesystem slash commands:', names);
        }
      })
      .catch((err: unknown) => {
        console.error('[CommandPaletteProvider] Failed to load slash commands:', err);
      });
  }, [bridge.isConnected, bridge.send, session.workingDirectory]);

  // Fetch slash commands on connect and when workingDirectory changes
  useEffect(() => {
    fetchSlashCommands();
  }, [fetchSlashCommands]);

  // CLI built-in commands from system/init event
  const cliBuiltinCommandNames = useMemo(() => {
    const raw = (systemInit as any)?.slash_commands;
    if (!Array.isArray(raw)) return [] as string[];
    return (raw as unknown[]).map((item: unknown) =>
      typeof item === 'string' ? item : (item as any)?.name ?? ''
    ).filter(Boolean) as string[];
  }, [systemInit]);

  useEffect(() => {
    if (cliBuiltinCommandNames.length > 0) {
      console.log('[CommandPaletteProvider] CLI built-in slash commands:', cliBuiltinCommandNames);
    }
  }, [cliBuiltinCommandNames]);

  // Merge: CLI built-in + filesystem custom (deduplicated)
  const allDynamicCommandNames = useMemo(() => {
    const merged = new Set([...cliBuiltinCommandNames, ...fsCommandNames]);
    return Array.from(merged);
  }, [cliBuiltinCommandNames, fsCommandNames]);

  const sections = useMemo(() => {
    if (allDynamicCommandNames.length > 0) {
      const localCommands = [
        new ClearCommand(), new InitCommand(), new ReviewCommand(),
        new HelpCommand(), new CompactCommand(),
      ];
      const localLabels: Set<string> = new Set(localCommands.map(c => c.label));
      const dynamicCommands = allDynamicCommandNames
        .filter(name => !localLabels.has(name.startsWith('/') ? name : `/${name}`))
        .map((name, i) => new CliPassthroughCommand(name, 100 + i));
      const allCommands = [...localCommands, ...dynamicCommands]
        .sort((a, b) => a.label.localeCompare(b.label));
      // Reassign order to preserve alphabetical sort (buildSections re-sorts by order)
      allCommands.forEach((cmd, i) => { (cmd as { order: number }).order = i; });
      registry.registerSection(new SlashCommandsSection(), allCommands);
    }
    const built = registry.buildSections();
    // Inject dynamic labels and handlers into sections
    for (const section of built) {
      if (section.id === PanelSectionId.SlashCommands) {
        section.onHeaderClick = fetchSlashCommands;
      }
    }
    return built;
  }, [registry, allDynamicCommandNames, fetchSlashCommands]);

  const contextValue = useMemo<CommandPaletteRegistryContextValue>(
    () => ({ registry, keyboardRegistry, sections }),
    [registry, keyboardRegistry, sections],
  );

  return (
    <CommandPaletteRegistryContext.Provider value={contextValue}>
      {children}
    </CommandPaletteRegistryContext.Provider>
  );
}
