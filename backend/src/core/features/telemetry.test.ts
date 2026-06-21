import { describe, it, expect, vi, afterEach } from 'vitest';

// 동의 상태별 전송 게이팅 검증. profile/settings/version을 주입한 뒤 telemetry 모듈을
// 동적 import하여(모듈 로드 시 API key를 const로 고정하므로) fetch 호출 여부를 본다.
// trackEvent/trackError는 fire-and-forget(void)이라 flushTelemetry()로 결정적으로 기다린다.

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

function mockCommonDeps() {
  vi.doMock('../handlers/getVersion', () => ({
    getPluginVersion: () => '0.0.0-test',
    getCliVersion: async () => '1.0.0',
  }));
}

async function loadTelemetry(profile: TestProfile, apiKey: string, fetchImpl?: () => Promise<unknown>) {
  vi.resetModules();
  vi.stubEnv('CCG_RYBBIT_API_KEY', apiKey);
  vi.doMock('./profile', () => ({
    readProfile: async () => profile,
    ConsentStatus: CONSENT_ENUM,
  }));
  mockCommonDeps();
  const fetchMock = vi.fn(fetchImpl ?? (async () => ({ ok: true })));
  vi.stubGlobal('fetch', fetchMock);
  const mod = await import('./telemetry');
  return { trackEvent: mod.trackEvent, trackError: mod.trackError, flushTelemetry: mod.flushTelemetry, fetchMock };
}

describe('telemetry consent gating', () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.doUnmock('./profile');
    vi.doUnmock('../handlers/getVersion');
  });

  it('ACCEPTED + API key면 전송한다', async () => {
    const { trackEvent, fetchMock, flushTelemetry } = await loadTelemetry(accepted, 'test-key');
    trackEvent('e', { a: '1' });
    await flushTelemetry();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('PENDING(미응답)이면 전송하지 않는다', async () => {
    const { trackEvent, fetchMock, flushTelemetry } = await loadTelemetry(pending, 'test-key');
    trackEvent('e', {});
    await flushTelemetry();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('DENIED(거부·철회)면 전송하지 않는다', async () => {
    const { trackEvent, fetchMock, flushTelemetry } = await loadTelemetry(denied, 'test-key');
    trackEvent('e', {});
    await flushTelemetry();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requireConsent=false면 DENIED여도 전송한다(철회 사실 전송)', async () => {
    const { trackEvent, fetchMock, flushTelemetry } = await loadTelemetry(denied, 'test-key');
    trackEvent('telemetry_consent', { action: 'deny' }, { requireConsent: false });
    await flushTelemetry();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('API key가 없으면(개발 빌드) 동의했어도 전송하지 않는다', async () => {
    const { trackEvent, fetchMock, flushTelemetry } = await loadTelemetry(accepted, '');
    trackEvent('e', {});
    await flushTelemetry();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('trackError도 동일한 동의 게이팅을 따른다', async () => {
    const { trackError, fetchMock, flushTelemetry } = await loadTelemetry(denied, 'test-key');
    trackError(new Error('boom'), {});
    await flushTelemetry();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('전송 중 에러가 나도 throw하지 않는다(에러 격리)', async () => {
    const { trackEvent, flushTelemetry } = await loadTelemetry(accepted, 'test-key', async () => {
      throw new Error('network down');
    });
    expect(() => trackEvent('e', {})).not.toThrow();
    await flushTelemetry(); // unhandled rejection 없이 조용히 삼켜져야 한다
  });

  it('properties가 2048자를 넘으면 잘라서 보낸다(fitProperties)', async () => {
    const { trackEvent, fetchMock, flushTelemetry } = await loadTelemetry(accepted, 'test-key');
    trackEvent('e', { big: 'x'.repeat(5000) });
    await flushTelemetry();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.properties.length).toBeLessThanOrEqual(2048);
  });

  it('서버가 거부(ok=false)하면 transport_error로 1회 재전송한다', async () => {
    const { trackEvent, fetchMock, flushTelemetry } = await loadTelemetry(accepted, 'test-key', async () => ({
      ok: false,
      status: 400,
      text: async () => 'bad request',
    }));
    trackEvent('e', {});
    await flushTelemetry();
    // 원본 1회 + transport_error 1회(재귀 가드로 그 이상은 없음)
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
