import { parseUserContent } from '../components/message-renderers/utils/parseUserContent';

/**
 * firstPrompt를 title로 변환
 * 시스템 프롬프트 태그를 제거한 후 50자로 자름
 */
export const toTitle = (v?: string): string => {
  if (!v) return 'No title';
  const { text } = parseUserContent(v);
  return text.substring(0, 50) || 'No title';
}
