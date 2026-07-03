import {
  AnyContentBlockDto,
  ContentBlockType,
  TextBlockDto,
} from '../../../dto/message/ContentBlockDto';

/**
 * Merge consecutive (adjacent) text content blocks into a single text block.
 *
 * Why: the renderer draws each content block as its own independent markdown
 * document. When Claude streams one logical block of prose (e.g. a single list)
 * as multiple adjacent text blocks, rendering them separately resets the
 * markdown parser at the block boundary and visually tears the list/sentence
 * apart (issue #155).
 *
 * Scope: only *adjacent* text blocks are joined. A `text → tool_use → text`
 * sequence is a meaningful split and is preserved untouched — real transcripts
 * never contain adjacent text blocks, so this narrow merge fixes the tear
 * without collapsing legitimately separated content.
 *
 * The join uses no separator: the block boundary carries no delimiter, so
 * concatenating the raw text reconstructs exactly what Claude streamed
 * (consistent with how text deltas are accumulated during streaming), keeping
 * the original data intact.
 */
export function mergeAdjacentTextBlocks(
  blocks: AnyContentBlockDto[],
): AnyContentBlockDto[] {
  const result: AnyContentBlockDto[] = [];
  for (const block of blocks) {
    const prev = result[result.length - 1] as AnyContentBlockDto | undefined;
    if (
      block.type === ContentBlockType.Text &&
      prev !== undefined &&
      prev.type === ContentBlockType.Text
    ) {
      result[result.length - 1] = {
        ...(prev as TextBlockDto),
        text: (prev as TextBlockDto).text + (block as TextBlockDto).text,
      } as TextBlockDto;
    } else {
      result.push(block);
    }
  }
  return result;
}
