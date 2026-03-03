// 83개 동사 배열
export const VERBS = [
    "Accomplishing", "Actioning", "Actualizing", "Baking", "Booping", "Brewing",
    "Calculating", "Cerebrating", "Channelling", "Churning", "Clauding",
    "Coalescing", "Cogitating", "Computing", "Combobulating", "Concocting",
    "Considering", "Contemplating", "Cooking", "Crafting", "Creating",
    "Crunching", "Deciphering", "Deliberating", "Determining", "Discombobulating",
    "Doing", "Effecting", "Elucidating", "Enchanting", "Envisioning",
    "Finagling", "Flibbertigibbeting", "Forging", "Forming", "Frolicking",
    "Generating", "Germinating", "Hatching", "Herding", "Honking",
    "Ideating", "Imagining", "Incubating", "Inferring", "Manifesting",
    "Marinating", "Meandering", "Moseying", "Mulling", "Mustering",
    "Musing", "Noodling", "Percolating", "Perusing", "Philosophising",
    "Pontificating", "Pondering", "Processing", "Puttering", "Puzzling",
    "Reticulating", "Ruminating", "Scheming", "Schlepping", "Shimmying",
    "Simmering", "Smooshing", "Spelunking", "Spinning", "Stewing",
    "Sussing", "Synthesizing", "Thinking", "Tinkering", "Transmuting",
    "Unfurling", "Unravelling", "Vibing", "Wandering", "Whirring",
    "Wibbling", "Working", "Wrangling",
] as const;

// 아이콘 프레임 (ping-pong)
export const BASE_FRAMES = ["·", "✢", "*", "✶", "✻", "✽"] as const;
export const ICON_FRAMES = [...BASE_FRAMES, ...[...BASE_FRAMES].reverse()];

// 텍스트 변경 딜레이 스케줄 (ms)
export const TEXT_CHANGE_DELAYS = [2000, 3000, 5000];

// 스크램블 중간 문자 후보
export const SCRAMBLE_CHARS = [".", "_"];
