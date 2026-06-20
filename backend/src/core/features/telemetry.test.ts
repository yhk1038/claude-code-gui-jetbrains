import { describe, it, expect, vi, afterEach } from 'vitest';

// 동의 상태별 전송 게이팅 검증. profile과 API key를 주입한 뒤 telemetry 모듈을
// 동적 import하여(모듈 로드 시 API key를 const로 고정하므로) fetch 호출 여부를 본다.
// trackEvent/trackError는 fire-and-forget(void)이라 전송 완료를 flush로 기다린다.

interface TestProfile {
  uuid: string;
  telemetryConsent: { status: string; decidedAt: string | null };
}

const CONSENT_ENUM = { PENDING: 'pending', ACCEPTED: 'accepted', DENIED: 'denied' };

const accepted: TestProfile = {
  uuid: 'test-uuid',
  telemetryConsent: { status: 'accepted', decidedAt: '2026-01-01T00:00:00.000Z' },
};
const denied: TestProfile = {
  uuid: 'test-uuid',
  telemetryConsent: { status: 'denied', decidedAt: '2026-01-01T00:00:00.000Z' },
};
const pending: TestProfile = {
  uuid: 'test-uuid',
  telemetryConsent: { status: 'pending', decidedAt: null },
};

/** fire-and-forget 전송(마이크로태스크)이 끝나도록 한 틱 흘린다. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

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

  it('ACCEPTED + API key면 전송한다', async () => {
    const { trackEvent, fetchMock } = await loadTelemetry(accepted, 'test-key');
    trackEvent('e', { a: '1' });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('PENDING(미응답)이면 전송하지 않는다', async () => {
    const { trackEvent, fetchMock } = await loadTelemetry(pending, 'test-key');
    trackEvent('e', {});
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('DENIED(거부·철회)면 전송하지 않는다', async () => {
    const { trackEvent, fetchMock } = await loadTelemetry(denied, 'test-key');
    trackEvent('e', {});
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requireConsent=false면 DENIED여도 전송한다(철회 사실 전송)', async () => {
    const { trackEvent, fetchMock } = await loadTelemetry(denied, 'test-key');
    trackEvent('telemetry_consent', { action: 'deny' }, { requireConsent: false });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('API key가 없으면(개발 빌드) 동의했어도 전송하지 않는다', async () => {
    const { trackEvent, fetchMock } = await loadTelemetry(accepted, '');
    trackEvent('e', {});
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('trackError도 동일한 동의 게이팅을 따른다', async () => {
    const { trackError, fetchMock } = await loadTelemetry(denied, 'test-key');
    trackError(new Error('boom'), {});
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('전송 중 에러가 나도 throw하지 않는다(에러 격리)', async () => {
    vi.resetModules();
    vi.stubEnv('CCG_RYBBIT_API_KEY', 'test-key');
    vi.doMock('./profile', () => ({
      readProfile: async () => accepted,
      ConsentStatus: CONSENT_ENUM,
    }));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const mod = await import('./telemetry');
    expect(() => mod.trackEvent('e', {})).not.toThrow();
    await flush(); // unhandled rejection 없이 조용히 삼켜져야 한다
  });
});
