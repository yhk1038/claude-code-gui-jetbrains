import React from 'react';
import { Message, getTextContent } from '../../types';

interface SystemMessageRendererProps {
  message: Message;
}

export const SystemMessageRenderer: React.FC<SystemMessageRendererProps> = ({ message }) => {
  return (
    <div className="flex justify-center py-3">
      <div className="px-4 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-[10px] text-zinc-400 font-mono">
        {getTextContent(message)}
      </div>
    </div>
  );
};
