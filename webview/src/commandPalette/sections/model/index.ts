export * from './ModelSection';
export * from './SwitchModelItem';
export * from './EffortItem';
export * from './ThinkingItem';
export * from './AccountUsageItem';
export * from './ToggleFastModeItem';

import { switchModelItem } from './SwitchModelItem';
import { effortItem } from './EffortItem';
import { thinkingItem } from './ThinkingItem';
import { accountUsageItem } from './AccountUsageItem';
import { toggleFastModeItem } from './ToggleFastModeItem';

export const modelItems = [
  switchModelItem,
  effortItem,
  thinkingItem,
  accountUsageItem,
  toggleFastModeItem,
];
