import { i18n } from '@/i18n';

// 83개 동사 목록 (i18n) — 렌더 시점마다 조회해 언어 전환에도 즉시 반응하도록
// 모듈 스코프 상수 대신 getter 함수로 제공한다.
export function getVerbs(): readonly string[] {
    return i18n.t('chat:streamingIndicator.verbs', { returnObjects: true }) as string[];
}

// 아이콘 프레임 (ping-pong)
export const BASE_FRAMES = ["·", "✢", "*", "✶", "✻", "✽"] as const;
export const ICON_FRAMES = [...BASE_FRAMES, ...[...BASE_FRAMES].reverse()];

// 텍스트 변경 딜레이 스케줄 (ms)
export const TEXT_CHANGE_DELAYS = [2000, 3000, 5000];

// 스크램블 중간 문자 후보
export const SCRAMBLE_CHARS = [".", "_"];
