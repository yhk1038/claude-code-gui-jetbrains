import React from 'react';
import { ContextUsage } from '@/utils/parseContextUsage';
import { ContextTreeSection } from './ContextTreeSection';
import { ContextMcpSection } from './ContextMcpSection';
import { buildAgentGroups, buildMemoryGroups, buildSkillGroups } from './treeModel';

interface Props {
  data: ContextUsage;
}

// Reconstructed detail-section subtitles (absent from the CLI markdown; these
// mirror the native TUI's source-path captions).
const SUBTITLE = {
  agents: '.claude/agents/',
  memory: '/memory',
  skills: '/skills',
  mcp: '/mcp (loaded on-demand)',
};

/**
 * The stacked detail sections beneath the context grid. The render order is
 * fixed to match the native TUI — MCP Tools → Custom Agents → Memory Files →
 * Skills — regardless of where those sections appeared in the CLI markdown
 * (only the order *between* sections is normalized; items within each section
 * keep the CLI's original order). MCP Tools renders as collapsible per-server
 * groups; the rest are static trees. Each section renders nothing when empty.
 */
export const ContextDetailSections: React.FC<Props> = (props: Props) => {
  const { data } = props;
  return (
    <>
      <ContextMcpSection title="MCP Tools" subtitle={SUBTITLE.mcp} tools={data.mcpTools} />
      <ContextTreeSection
        title="Custom Agents"
        subtitle={SUBTITLE.agents}
        groups={buildAgentGroups(data.customAgents)}
      />
      <ContextTreeSection
        title="Memory Files"
        subtitle={SUBTITLE.memory}
        groups={buildMemoryGroups(data.memoryFiles)}
      />
      <ContextTreeSection
        title="Skills"
        subtitle={SUBTITLE.skills}
        groups={buildSkillGroups(data.skills)}
      />
    </>
  );
};
