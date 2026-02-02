/**
 * 사용자 메시지에서 시스템 태그를 제거하고 정리된 텍스트를 반환
 *
 * 제거 대상 태그:
 * - <ide_opened_file>...</ide_opened_file>
 * - <ide_selection>...</ide_selection>
 * - <system-reminder>...</system-reminder>
 */
export function parseUserContent(content: string): {
  text: string;
} {
  // 시스템 태그 정규식으로 제거 (여러 줄 지원)
  const systemTagPattern = /<(ide_opened_file|ide_selection|system-reminder)>[\s\S]*?<\/\1>/g;

  let cleanText = content.replace(systemTagPattern, '');

  // 중복 공백/줄바꿈 정리
  cleanText = cleanText
    .replace(/\n{3,}/g, '\n\n')  // 3개 이상의 연속된 줄바꿈을 2개로
    .trim();

  return { text: cleanText };
}
