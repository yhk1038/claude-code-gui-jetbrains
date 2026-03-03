import { Context, ContextType } from '../../../types';

/**
 * 사용자 메시지에서 시스템 태그를 파싱하여 컨텍스트를 추출하고, 정리된 텍스트를 반환
 *
 * 추출 대상 태그:
 * - <ide_opened_file>...</ide_opened_file> → Context { type: 'file' }
 * - <ide_selection>...</ide_selection> → Context { type: 'selection' }
 * - <command-name>...</command-name> → commandName 필드로 추출
 *
 * 제거만 하는 태그:
 * - <system-reminder>...</system-reminder>
 * - <local-command-caveat>...</local-command-caveat> → hasLocalCommandCaveat: true
 * - <command-message>...</command-message>
 * - <command-args>...</command-args>
 * - <local-command-stdout> (태그만 제거, 내용 보존)
 */
export function parseUserContent(content: string): {
  text: string;
  contexts: Context[];
  commandName?: string;
  hasLocalCommandCaveat?: boolean;
} {
  const contexts: Context[] = [];

  // Step A: <ide_opened_file> 태그에서 파일 경로 추출
  const openedFilePattern = /<ide_opened_file>([\s\S]*?)<\/ide_opened_file>/g;
  let match;
  while ((match = openedFilePattern.exec(content)) !== null) {
    const ctx = parseOpenedFileTag(match[1]);
    if (ctx) contexts.push(ctx);
  }
  let cleanText = content.replace(openedFilePattern, '');

  // Step B: <ide_selection> 태그에서 선택 영역 추출
  const selectionPattern = /<ide_selection>([\s\S]*?)<\/ide_selection>/g;
  while ((match = selectionPattern.exec(content)) !== null) {
    const ctx = parseSelectionTag(match[1]);
    if (ctx) contexts.push(ctx);
  }
  cleanText = cleanText.replace(selectionPattern, '');

  // Step C: <system-reminder> 태그 제거 (추출 없이)
  const systemReminderPattern = /<system-reminder>[\s\S]*?<\/system-reminder>/g;
  cleanText = cleanText.replace(systemReminderPattern, '');

  // Step E: <command-name> 태그에서 명령어 이름 추출 (선행 / 제거)
  let commandName: string | undefined;
  const commandMatch = /<command-name>([\s\S]*?)<\/command-name>/.exec(content);
  if (commandMatch) {
    commandName = commandMatch[1].trim().replace(/^\/+/, '');
  }
  cleanText = cleanText.replace(/<command-name>[\s\S]*?<\/command-name>/g, '');

  // Step F: <local-command-caveat> 태그 제거 및 플래그 설정
  const hasLocalCommandCaveat = /<local-command-caveat>/.test(content);
  cleanText = cleanText.replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, '');

  // Step G: <command-message>, <command-args> 태그+내용 제거, <local-command-stdout> 태그만 제거(내용 보존)
  cleanText = cleanText.replace(/<command-message>[\s\S]*?<\/command-message>/g, '');
  cleanText = cleanText.replace(/<command-args>[\s\S]*?<\/command-args>/g, '');
  cleanText = cleanText.replace(/<\/?local-command-stdout>/g, '');

  // Step H: command가 감지되면 남은 텍스트에서 리터럴 /commandName 제거
  if (commandName) {
    cleanText = cleanText.replace(new RegExp(`^\\s*//?${commandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'g'), '');
  }

  // Step I: 중복 공백/줄바꿈 정리
  cleanText = cleanText
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text: cleanText, contexts, commandName, hasLocalCommandCaveat };
}

/**
 * <ide_opened_file> 태그 내용에서 파일 경로를 추출
 * 예: "The user opened the file /path/to/file.ts in the IDE. This may or may not be related to the current task."
 */
function parseOpenedFileTag(tagContent: string): Context | null {
  const pathMatch = tagContent.match(/The user opened the file (.+?) in the IDE/);
  if (!pathMatch) return null;

  return {
    type: ContextType.File,
    path: pathMatch[1].trim(),
    content: tagContent.trim(),
  };
}

/**
 * <ide_selection> 태그 내용에서 선택 영역 정보를 추출
 * 예: "The user selected the lines 42 to 51 from /path/to/file.ts:\n...code...\n\nThis may or may not be related to the current task."
 */
function parseSelectionTag(tagContent: string): Context | null {
  // 줄 범위가 있는 형태
  const rangeMatch = tagContent.match(
    /The user selected the lines (\d+) to (\d+) from (.+?):\n([\s\S]*?)(?:\n\nThis may or may not|$)/
  );
  if (rangeMatch) {
    return {
      type: ContextType.Selection,
      path: rangeMatch[3].trim(),
      content: rangeMatch[4].trim(),
      startLine: parseInt(rangeMatch[1], 10),
      endLine: parseInt(rangeMatch[2], 10),
    };
  }

  // 줄 범위 없이 파일 경로만 있는 형태
  const simpleMatch = tagContent.match(
    /The user selected (?:.*?) (?:in|from) (.+?)(?::\n([\s\S]*?))?(?:\n\nThis may or may not|$)/
  );
  if (simpleMatch) {
    return {
      type: ContextType.Selection,
      path: simpleMatch[1].trim(),
      content: (simpleMatch[2] || tagContent).trim(),
    };
  }

  return null;
}
