import React from 'react';
import { LoadedMessageDto, getTextContent } from '../../types';

interface SystemMessageRendererProps {
  message: LoadedMessageDto;
}

export const SystemMessageRenderer: React.FC<SystemMessageRendererProps> = ({ message }) => {
  return (
    <div className="justify-center py-3 hidden">
      <div className="px-4 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-[10px] text-zinc-400 font-mono">
        {getTextContent(message)}
      </div>
    </div>
  );
};
