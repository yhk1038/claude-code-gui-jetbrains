import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import clawdSvg from '../assets/clawd.svg';
import claudeCodeLogo from '../assets/claude-code-logo.svg';

export const EmptyState = () => {
  const isMac = navigator.platform.toUpperCase().includes('MAC');

  const kbdClass = "inline-flex items-center px-1.5 py-0.5 bg-zinc-700 rounded text-zinc-300 text-xs font-mono";

  const hints: ReactNode[] = useMemo(
    () => [
      '// TODO: Everything. Let\'s start.',
      <>Ready to code?<br />Let&apos;s write something worth deploying.</>,
      'Type /model to pick the right tool for the job.',
      'Make a CLAUDE.md file for instructions Claude will read every single time.',
      "Tired of repeating yourself? Tell Claude to remember what you've told it using CLAUDE.md.",
      <>Press <kbd className={kbdClass}>Shift</kbd> <kbd className={kbdClass}>Tab</kbd> to automatically approve code edits</>,
      <>Highlight any text and press <kbd className={kbdClass}>{isMac ? 'Option' : 'Alt'}</kbd> <kbd className={kbdClass}>K</kbd> to chat about it</>,
      "Use Claude Code in the terminal to configure MCP servers. They'll work here, too!",
      <>Use planning mode to talk through big changes before a commit. Press <kbd className={kbdClass}>Shift</kbd> <kbd className={kbdClass}>Tab</kbd> to cycle between modes.</>,
      'Type /model to pick the right tool for the job.',
      "You've come to the absolutely right place!",
    ],
    [isMac],
  );

  const [hint, setHint] = useState<ReactNode>(
    'What to do first? Ask about this codebase or we can start writing code.',
  );

  useEffect(() => {
    const index = Math.floor(Math.random() * hints.length);
    setHint(hints[index]);
  }, [hints]);

  return (
    <div className="h-full flex flex-col">
      <div className="pt-4 flex justify-center">
        <img src={claudeCodeLogo} alt="Claude Code" width={120} />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-5 pt-14">
        <img src={clawdSvg} alt="Clawd" width={46} />
        <p className="text-zinc-300 text-[13px] text-center max-w-[18rem] leading-[1.7]">{hint}</p>
      </div>
    </div>
  );
};
