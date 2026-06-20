import { describe, it, expect, vi, afterEach } from 'vitest';

// 동의 상태별 전송 게이팅 검증. profile과 API key를 주입한 뒤 telemetry 모듈을
// 동적 import하여(모듈 로드 시 API key를 const로 고정하므로) fetch 호출 여부를 본다.

interface TestProfile {
  uuid: string;
  telemetryConsent: { status: string; decidedAt: string | null };
}

const CONSENT_ENUM = { PENDING: 'pending', GRANTED: 'granted', DENIED: 'denied' };

const granted: TestProfile = {
  uuid: 'test-uuid',
  telemetryConsent: { status: 'granted', decidedAt: '2026-01-01T00:00:00.000Z' },
};
const denied: TestProfile = {
  uuid: 'test-uuid',
  telemetryConsent: { status: 'denied', decidedAt: '2026-01-01T00:00:00.000Z' },
};
const pending: TestProfile = {
  uuid: 'test-uuid',
  telemetryConsent: { status: 'pending', decidedAt: null },
};

async function loadTelemetry(profile: TestProfile, apiKey: string) {
  vi.resetModules();
  vi.stubEnv('CCG_RYBBIT_API_KEY', apiKey);
  vi.doMock('./profile', () => ({
    readProfile: async () => profile,
    ConsentStatus: CONSENT_ENUM,
  }));
  const fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchMock);
  const mod = await import('./telemetry');
  return { trackEvent: mod.trackEvent, trackError: mod.trackError, fetchMock };
}

describe('telemetry consent gating', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.doUnmock('./profile');
  });

  it('GRANTED + API key면 전송한다', async () => {
    const { trackEvent, fetchMock } = await loadTelemetry(granted, 'test-key');
    await trackEvent('e', { a: '1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('PENDING(미응답)이면 전송하지 않는다', async () => {
    const { trackEvent, fetchMock } = await loadTelemetry(pending, 'test-key');
    await trackEvent('e', {});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('DENIED(거절·철회)면 전송하지 않는다', async () => {
    const { trackEvent, fetchMock } = await loadTelemetry(denied, 'test-key');
    await trackEvent('e', {});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('API key가 없으면(개발 빌드) 동의했어도 전송하지 않는다', async () => {
    const { trackEvent, fetchMock } = await loadTelemetry(granted, '');
    await trackEvent('e', {});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('trackError도 동일한 동의 게이팅을 따른다', async () => {
    const { trackError, fetchMock } = await loadTelemetry(denied, 'test-key');
    await trackError(new Error('boom'), {});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
