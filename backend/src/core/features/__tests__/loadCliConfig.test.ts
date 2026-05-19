import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';
import type { ChildProcess } from 'child_process';

vi.mock('../../claude', () => ({
  Claude: {
    spawn: vi.fn(),
  },
}));

import { Claude } from '../../claude';
import { loadCliConfig, parseCliConfigResponse, _resetCliConfigCache } from '../loadCliConfig';

function makeFakeProc(stdoutPayload: string): ChildProcess {
  const proc = new EventEmitter() as unknown as ChildProcess;
  const stdout = new Readable({ read() {} });
  const stderr = new Readable({ read() {} });
  const stdin = new Writable({ write(_c, _e, cb) { cb(); } });
  (proc as unknown as { stdout: Readable }).stdout = stdout;
  (proc as unknown as { stderr: Readable }).stderr = stderr;
  (proc as unknown as { stdin: Writable }).stdin = stdin;
  (proc as unknown as { pid: number }).pid = 1234;
  (proc as unknown as { kill: () => void }).kill = () => {};
  setImmediate(() => {
    proc.emit('spawn');
    stdout.push(stdoutPayload);
  });
  return proc;
}

function controlResponse(commandName: string): string {
  return JSON.stringify({
    type: 'control_response',
    response: {
      subtype: 'success',
      request_id: 'config_init',
      response: {
        commands: [{ name: commandName, description: '', argumentHint: '' }],
        agents: [],
        output_style: 'default',
        available_output_styles: [],
        models: [],
        account: { email: '', subscriptionType: '' },
        pid: 1,
      },
    },
  }) + '\n';
}

describe('loadCliConfig', () => {
  beforeEach(() => {
    _resetCliConfigCache();
    vi.mocked(Claude.spawn).mockReset();
  });

  describe('cache', () => {
    it('caches per workingDir — different projects get different configs', async () => {
      vi.mocked(Claude.spawn).mockImplementation((_args, options) => {
        const cwd = options?.cwd as string;
        const cmdName = cwd === '/project/a' ? 'skill-a' : 'skill-b';
        return makeFakeProc(controlResponse(cmdName));
      });

      const configA = await loadCliConfig('/project/a');
      const configB = await loadCliConfig('/project/b');

      expect(configA?.response.response.commands[0].name).toBe('skill-a');
      expect(configB?.response.response.commands[0].name).toBe('skill-b');
    });

    it('returns the cached config for the same workingDir without respawning', async () => {
      vi.mocked(Claude.spawn).mockImplementation(() => makeFakeProc(controlResponse('skill-a')));

      await loadCliConfig('/project/a');
      await loadCliConfig('/project/a');

      expect(vi.mocked(Claude.spawn)).toHaveBeenCalledTimes(1);
    });

    it('refresh:true bypasses the cache and re-spawns', async () => {
      vi.mocked(Claude.spawn).mockImplementationOnce(() => makeFakeProc(controlResponse('first')));
      const first = await loadCliConfig('/project/a');

      vi.mocked(Claude.spawn).mockImplementationOnce(() => makeFakeProc(controlResponse('second')));
      const second = await loadCliConfig('/project/a', { refresh: true });

      expect(first?.response.response.commands[0].name).toBe('first');
      expect(second?.response.response.commands[0].name).toBe('second');
      expect(vi.mocked(Claude.spawn)).toHaveBeenCalledTimes(2);
    });
  });

  describe('parseCliConfigResponse', () => {
    it('should return control_response as-is', () => {
      const controlResponse = {
        type: 'control_response',
        response: {
          subtype: 'success',
          request_id: 'init_1',
          response: {
            commands: [
              { name: 'compact', description: 'Compact conversation history', argumentHint: '' },
              { name: 'debug', description: 'Enable debug logging', argumentHint: '[issue]' },
            ],
            agents: [],
            output_style: 'default',
            available_output_styles: ['default'],
            models: [],
            account: { email: 'test@test.com', subscriptionType: 'Pro' },
            pid: 12345,
          },
        },
      };
      const stdout = JSON.stringify(controlResponse) + '\n';
      const result = parseCliConfigResponse(stdout);
      expect(result).toEqual(controlResponse);
    });

    it('should find control_response among other events', () => {
      const lines = [
        '{"type":"system","subtype":"hook_started","hook_id":"abc"}',
        '{"type":"control_response","response":{"subtype":"success","request_id":"config_init","response":{"commands":[{"name":"debug","description":"Enable debug logging","argumentHint":"[issue]"}],"agents":[],"output_style":"default","available_output_styles":[],"models":[],"account":{"email":"a@b.com","subscriptionType":"Free"},"pid":1}}}',
      ];
      const stdout = lines.join('\n') + '\n';
      const result = parseCliConfigResponse(stdout);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('control_response');
      expect(result!.response.response.commands).toHaveLength(1);
      expect(result!.response.response.commands[0].name).toBe('debug');
    });

    it('should return null when no control_response is found', () => {
      const stdout = '{"type":"system","subtype":"hook_started","hook_id":"abc"}\n';
      const result = parseCliConfigResponse(stdout);
      expect(result).toBeNull();
    });

    it('should handle empty stdout', () => {
      const result = parseCliConfigResponse('');
      expect(result).toBeNull();
    });

    it('should skip malformed JSON lines gracefully', () => {
      const controlResponse = {
        type: 'control_response',
        response: {
          subtype: 'success',
          request_id: 'init_1',
          response: {
            commands: [{ name: 'foo', description: '', argumentHint: '' }],
            agents: [],
            output_style: 'default',
            available_output_styles: [],
            models: [],
            account: { email: '', subscriptionType: '' },
            pid: 0,
          },
        },
      };
      const lines = [
        'not valid json',
        JSON.stringify(controlResponse),
      ];
      const stdout = lines.join('\n') + '\n';
      const result = parseCliConfigResponse(stdout);
      expect(result).toEqual(controlResponse);
    });
  });
});
