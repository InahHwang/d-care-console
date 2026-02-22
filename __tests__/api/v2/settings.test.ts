// __tests__/api/v2/settings.test.ts
// V2 설정 API 통합 테스트

jest.mock('@/utils/mongodb', () => ({
  connectToDatabase: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  createRouteLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  }),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
// 캐시는 실제 동작하되 in-memory로 사용 (테스트 간 초기화)
jest.mock('@/lib/cache', () => {
  const actual = jest.requireActual('@/lib/cache');
  return actual;
});

import { GET, PATCH } from '@/app/api/v2/settings/route';
import { createMockNextRequest, DEFAULT_TEST_USER } from '../../helpers/mockRequest';
import { createMockDb, createMockCollection, setupMockMongodb } from '../../helpers/mockDb';
import { cache } from '@/lib/cache';

const DEFAULT_SETTINGS = {
  clinicId: DEFAULT_TEST_USER.clinicId,
  clinicName: '내 병원',
  cti: { enabled: true, serverUrl: '', agentId: '' },
  ai: { enabled: true, autoAnalysis: true, model: 'gpt-4o-mini' },
  notifications: { missedCall: true, newPatient: true, callback: true },
  targets: { monthlyRevenue: 10000, dailyCalls: 50, conversionRate: 30 },
  updatedAt: new Date().toISOString(),
};

describe('/api/v2/settings', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    // 캐시 초기화
    cache.invalidatePrefix('settings:');

    mockDb = createMockDb({
      settings_v2: createMockCollection([]),
    });
    setupMockMongodb(mockDb);
  });

  // ===== 인증 =====

  describe('GET - 인증', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const req = createMockNextRequest('GET', '/api/v2/settings');
      const res = await GET(req);
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH - 인증', () => {
    it('토큰 없이 PATCH하면 401을 반환한다', async () => {
      const req = createMockNextRequest('PATCH', '/api/v2/settings', {
        body: { clinicName: '새이름' },
      });
      const res = await PATCH(req);
      expect(res.status).toBe(401);
    });
  });

  // ===== GET =====

  describe('GET - 설정 조회', () => {
    it('설정이 없으면 기본값으로 자동 생성한다', async () => {
      const settingsCol = mockDb.collection('settings_v2');
      settingsCol.findOne.mockResolvedValue(null); // 설정 없음

      const req = createMockNextRequest('GET', '/api/v2/settings', { auth: true });
      const res = await GET(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.clinicName).toBe('내 병원');
      expect(settingsCol.insertOne).toHaveBeenCalled(); // 기본 설정 생성됨
    });

    it('기존 설정이 있으면 그대로 반환한다', async () => {
      const existingSettings = {
        ...DEFAULT_SETTINGS,
        clinicName: '행복치과',
        targets: { monthlyRevenue: 50000, dailyCalls: 100, conversionRate: 40 },
      };

      const settingsCol = mockDb.collection('settings_v2');
      settingsCol.findOne.mockResolvedValue(existingSettings);

      const req = createMockNextRequest('GET', '/api/v2/settings', { auth: true });
      const res = await GET(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.clinicName).toBe('행복치과');
      expect(body.data.targets.monthlyRevenue).toBe(50000);
    });
  });

  // ===== PATCH =====

  describe('PATCH - 설정 업데이트', () => {
    it('유효한 부분 업데이트가 성공한다', async () => {
      const settingsCol = mockDb.collection('settings_v2');
      settingsCol.findOneAndUpdate.mockResolvedValue({
        ...DEFAULT_SETTINGS,
        clinicName: '새치과이름',
      });

      const req = createMockNextRequest('PATCH', '/api/v2/settings', {
        auth: true,
        body: { clinicName: '새치과이름' },
      });

      const res = await PATCH(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('업데이트 후 캐시가 무효화된다', async () => {
      const settingsCol = mockDb.collection('settings_v2');

      // 먼저 GET으로 캐시 세팅
      settingsCol.findOne.mockResolvedValue({ ...DEFAULT_SETTINGS, clinicName: '원래이름' });
      const getReq1 = createMockNextRequest('GET', '/api/v2/settings', { auth: true });
      await GET(getReq1);

      // PATCH로 업데이트 → 캐시 무효화
      settingsCol.findOneAndUpdate.mockResolvedValue({ ...DEFAULT_SETTINGS, clinicName: '변경이름' });
      const patchReq = createMockNextRequest('PATCH', '/api/v2/settings', {
        auth: true,
        body: { clinicName: '변경이름' },
      });
      await PATCH(patchReq);

      // 다시 GET → DB에서 다시 읽어야 함
      settingsCol.findOne.mockClear();
      settingsCol.findOne.mockResolvedValue({ ...DEFAULT_SETTINGS, clinicName: '변경이름' });

      const getReq2 = createMockNextRequest('GET', '/api/v2/settings', { auth: true });
      const res2 = await GET(getReq2);
      const body2 = await res2.json();
      expect(body2.data.clinicName).toBe('변경이름');
      expect(settingsCol.findOne).toHaveBeenCalled(); // 캐시 miss → DB 조회
    });

    it('잘못된 body로 PATCH하면 400을 반환한다', async () => {
      const req = createMockNextRequest('PATCH', '/api/v2/settings', {
        auth: true,
        body: { targets: { monthlyRevenue: 'not-a-number' } },
      });

      const res = await PATCH(req);
      expect(res.status).toBe(400);
    });
  });
});
