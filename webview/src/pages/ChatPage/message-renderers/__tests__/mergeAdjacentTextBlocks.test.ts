import { describe, it, expect } from 'vitest';
import { mergeAdjacentTextBlocks } from '../mergeAdjacentTextBlocks';
import { AnyContentBlockDto, ContentBlockType, TextBlockDto } from '../../../../dto/message/ContentBlockDto';

const text = (t: string): TextBlockDto =>
  ({ type: ContentBlockType.Text, text: t } as TextBlockDto);
const toolUse = (id: string): AnyContentBlockDto =>
  ({ type: ContentBlockType.ToolUse, id, name: 'Bash', input: {} } as AnyContentBlockDto);
const thinking = (t: string): AnyContentBlockDto =>
  ({ type: ContentBlockType.Thinking, thinking: t } as AnyContentBlockDto);

describe('mergeAdjacentTextBlocks', () => {
  it('leaves an empty array unchanged', () => {
    expect(mergeAdjacentTextBlocks([])).toEqual([]);
  });

  it('leaves a single text block unchanged', () => {
    const blocks = [text('- 유일한 방법입니다.')];
    expect(mergeAdjacentTextBlocks(blocks)).toEqual([text('- 유일한 방법입니다.')]);
  });

  it('merges two adjacent text blocks into one by concatenating raw text', () => {
    // This is the #155 case: one list split across two text blocks.
    const blocks = [text('- ...현재로선 유일'), text('한 방법입니다.')];
    const merged = mergeAdjacentTextBlocks(blocks);
    expect(merged).toHaveLength(1);
    expect(merged[0].type).toBe(ContentBlockType.Text);
    expect((merged[0] as TextBlockDto).text).toBe('- ...현재로선 유일한 방법입니다.');
  });

  it('does NOT merge text blocks separated by a tool_use (normal split is preserved)', () => {
    const blocks = [text('before'), toolUse('t1'), text('after')];
    const merged = mergeAdjacentTextBlocks(blocks);
    expect(merged).toHaveLength(3);
    expect(merged.map((b) => b.type)).toEqual([
      ContentBlockType.Text,
      ContentBlockType.ToolUse,
      ContentBlockType.Text,
    ]);
  });

  it('merges only within runs, preserving non-text boundaries and order', () => {
    const blocks = [
      thinking('thought'),
      text('a'),
      text('b'),
      toolUse('t1'),
      text('c'),
      text('d'),
    ];
    const merged = mergeAdjacentTextBlocks(blocks);
    expect(merged.map((b) => b.type)).toEqual([
      ContentBlockType.Thinking,
      ContentBlockType.Text,
      ContentBlockType.ToolUse,
      ContentBlockType.Text,
    ]);
    expect((merged[1] as TextBlockDto).text).toBe('ab');
    expect((merged[3] as TextBlockDto).text).toBe('cd');
  });

  it('does not mutate the input array', () => {
    const blocks = [text('x'), text('y')];
    const snapshot = JSON.parse(JSON.stringify(blocks));
    mergeAdjacentTextBlocks(blocks);
    expect(blocks).toEqual(snapshot);
  });
});
