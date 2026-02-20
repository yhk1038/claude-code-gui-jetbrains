import React from 'react';

export const StreamingIndicator: React.FC = () => {
    return (
        <div className="flex items-center gap-1.5 mb-1">
            <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse"/>
            <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse delay-75"/>
            <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse delay-150"/>
        </div>
    );
};
