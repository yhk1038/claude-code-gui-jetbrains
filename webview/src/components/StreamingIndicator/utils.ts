// 배열에서 이전 값과 다른 랜덤 값 선택
export function randomPick<T>(arr: readonly T[], exclude?: T): T {
    const candidates = exclude !== undefined ? arr.filter((v) => v !== exclude) : [...arr];
    return candidates[Math.floor(Math.random() * candidates.length)];
}
