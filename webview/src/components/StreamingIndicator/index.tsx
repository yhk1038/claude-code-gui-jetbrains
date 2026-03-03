import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ICON_FRAMES, TEXT_CHANGE_DELAYS, VERBS } from './constants.ts';
import { useScramble } from './useScramble.ts';
import { randomPick } from './utils.ts';

export const StreamingIndicator: React.FC = () => {
    // 아이콘 프레임 인덱스
    const [frameIdx, setFrameIdx] = useState(0);

    // 현재 동사
    const [verb, setVerb] = useState<string>(() => randomPick(VERBS));

    // 텍스트 변경 카운트 (딜레이 스케줄 추적)
    const changeCountRef = useRef<number>(0);
    const textTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 다음 텍스트 변경 딜레이 계산
    const getNextDelay = useCallback(() => {
        const count = changeCountRef.current;
        if (count === 0) return TEXT_CHANGE_DELAYS[0];
        if (count === 1) return TEXT_CHANGE_DELAYS[1];
        return TEXT_CHANGE_DELAYS[2];
    }, []);

    // 텍스트 변경 스케줄링
    const scheduleNextChange = useCallback((currentVerb: string) => {
        if (textTimerRef.current !== null) {
            clearTimeout(textTimerRef.current);
        }
        const delay = getNextDelay();
        textTimerRef.current = setTimeout(() => {
            const next = randomPick(VERBS, currentVerb as typeof VERBS[number]);
            changeCountRef.current += 1;
            setVerb(next);
        }, delay);
    }, [getNextDelay]);

    // 아이콘 인터벌 (120ms)
    useEffect(() => {
        const interval = setInterval(() => {
            setFrameIdx((prev) => (prev + 1) % ICON_FRAMES.length);
        }, 120);
        return () => clearInterval(interval);
    }, []);

    // 텍스트 변경 스케줄 초기화
    useEffect(() => {
        scheduleNextChange(verb);
        // verb가 바뀔 때마다 다음 변경을 재스케줄
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [verb]);

    // cleanup
    useEffect(() => {
        return () => {
            if (textTimerRef.current !== null) {
                clearTimeout(textTimerRef.current);
            }
        };
    }, []);

    // 스크램블 디스플레이
    const displayText = useScramble(verb);

    return (
        <div>
            <div className="group pt-2 pb-4 pl-[22px] pr-3">
                <div className="flex items-start gap-3">
                    {/* 아이콘 프레임 */}
                    <span className="text-fuchsia-400 mt-[3px] text-[11px] leading-none select-none w-3 text-center shrink-0">
                        {ICON_FRAMES[frameIdx]}
                    </span>

                    {/* 스크램블 텍스트 */}
                    <div className="flex-1 min-w-0">
                        <span className="text-zinc-500 text-xs font-mono">
                            {displayText}...
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
