/**
 * Anthropic OAuth Usage API response types.
 * 필드명은 API 원본 그대로 유지 (원본 데이터 보존 원칙).
 */

export interface UsageBucket {
  utilization: number;       // 0-100 percentage
  resets_at: string;         // ISO 8601 datetime
}

export interface ExtraUsage {
  is_enabled: boolean;
  monthly_limit: number | null;
  used_credits: number | null;
  utilization: number | null;
}

export interface UsageResponse {
  five_hour: UsageBucket | null;
  seven_day: UsageBucket | null;
  seven_day_oauth_apps: UsageBucket | null;
  seven_day_sonnet: UsageBucket | null;
  seven_day_opus: UsageBucket | null;
  seven_day_cowork: UsageBucket | null;
  iguana_necktie: UsageBucket | null;
  extra_usage: ExtraUsage | null;
}
