import { useEffect, useRef, useState } from 'react';
import { SCRAMBLE_CHARS } from './constants.ts';

// 스크램블 애니메이션 훅
export function useScramble(target: string, onDone?: () => void) {
    const [display, setDisplay] = useState(target);
    const rafRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);
    const indexRef = useRef<number>(0);

    useEffect(() => {
        indexRef.current = 0;
        lastTimeRef.current = 0;

        const animate = (now: number) => {
            if (now - lastTimeRef.current >= 40) {
                lastTimeRef.current = now;
                const i = indexRef.current;

                if (i >= target.length) {
                    setDisplay(target);
                    onDone?.();
                    return;
                }

                setDisplay(() => {
                    let result = '';
                    for (let c = 0; c < target.length; c++) {
                        if (c < i) {
                            // 이미 확정된 문자
                            result += target[c];
                        } else if (c === i) {
                            // 현재 위치: 커서
                            result += '▌';
                        } else {
                            // 미도달: 랜덤 스크램블
                            const roll = Math.random();
                            if (roll < 0.33) {
                                result += target[c];
                            } else if (roll < 0.66) {
                                result += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
                            } else {
                                result += '▌';
                            }
                        }
                    }
                    return result;
                });

                indexRef.current += 1;
            }

            rafRef.current = requestAnimationFrame(animate);
        };

        rafRef.current = requestAnimationFrame(animate);

        return () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

    return display;
}
