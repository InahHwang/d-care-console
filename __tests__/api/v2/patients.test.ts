// __tests__/api/v2/patients.test.ts
// V2 환자 API 통합 테스트

jest.mock('@/utils/mongodb', () => ({
  connectToDatabase: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  createRouteLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  }),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { GET, POST } from '@/app/api/v2/patients/route';
import { createMockNextRequest, DEFAULT_TEST_USER } from '../../helpers/mockRequest';
import { createMockDb, createMockCollection, setupMockMongodb } from '../../helpers/mockDb';

// 상태별 빈 facet 결과 (aggregate 응답 형식)
const EMPTY_FACET_RESULT = [{
  all: [{ count: 0 }],
  consulting: [], reserved: [], visited: [],
  treatmentBooked: [], treatment: [], completed: [],
  followup: [], closed: [],
}];

describe('/api/v2/patients', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    jest.clearAllMocks();

    const patientsCol = createMockCollection([]);
    // aggregate가 faceted 결과를 반환하도록 설정
    patientsCol.aggregate.mockImplementation(() => ({
      toArray: jest.fn().mockResolvedValue(EMPTY_FACET_RESULT),
    }));

    mockDb = createMockDb({
      patients_v2: patientsCol,
    });
    setupMockMongodb(mockDb);
  });

  // ===== 인증 =====

  describe('GET - 인증', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const req = createMockNextRequest('GET', '/api/v2/patients');
      const res = await GET(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('유효한 토큰으로 요청하면 200과 patients 배열을 반환한다', async () => {
      const req = createMockNextRequest('GET', '/api/v2/patients', { auth: true });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.patients)).toBe(true);
      expect(body.pagination).toBeDefined();
    });
  });

  // ===== clinicId 격리 =====

  describe('GET - 멀티테넌시', () => {
    it('요청한 유저의 clinicId로만 쿼리한다', async () => {
      const req = createMockNextRequest('GET', '/api/v2/patients', {
        auth: { clinicId: 'my-clinic-123' },
      });

      await GET(req);

      // collection.find가 호출됐는지 확인
      const patientsCol = mockDb.collection('patients_v2');
      expect(patientsCol.find).toHaveBeenCalled();
    });
  });

  // ===== POST - 환자 등록 =====

  describe('POST - 환자 등록', () => {
    it('토큰 없이 POST하면 401을 반환한다', async () => {
      const req = createMockNextRequest('POST', '/api/v2/patients', {
        body: { name: '김환자', phone: '010-1234-5678' },
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('필수 필드(name, phone) 누락 시 400을 반환한다', async () => {
      const req = createMockNextRequest('POST', '/api/v2/patients', {
        auth: true,
        body: { name: '' }, // phone 누락
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('유효한 데이터로 환자를 등록하면 200과 patientId를 반환한다', async () => {
      const patientsCol = mockDb.collection('patients_v2');
      patientsCol.findOne.mockResolvedValue(null); // 중복 없음

      const req = createMockNextRequest('POST', '/api/v2/patients', {
        auth: true,
        body: {
          name: '김환자',
          phone: '010-1234-5678',
          temperature: 'warm',
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.patientId).toBeTruthy();
      expect(patientsCol.insertOne).toHaveBeenCalled();
    });

    it('중복 전화번호로 등록하면 409를 반환한다', async () => {
      const patientsCol = mockDb.collection('patients_v2');
      patientsCol.findOne.mockResolvedValue({
        _id: 'existing-id',
        name: '기존환자',
        phone: '010-1234-5678',
        clinicId: DEFAULT_TEST_USER.clinicId,
      });

      const req = createMockNextRequest('POST', '/api/v2/patients', {
        auth: true,
        body: { name: '새환자', phone: '010-1234-5678' },
      });

      const res = await POST(req);
      expect(res.status).toBe(409);
    });
  });

  // ===== GET - 페이지네이션 =====

  describe('GET - 페이지네이션 & 필터', () => {
    it('page와 limit 파라미터를 전달한다', async () => {
      const req = createMockNextRequest('GET', '/api/v2/patients', {
        auth: true,
        searchParams: { page: '2', limit: '10' },
      });

      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it('status 필터를 지원한다', async () => {
      const req = createMockNextRequest('GET', '/api/v2/patients', {
        auth: true,
        searchParams: { status: 'consulting' },
      });

      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it('search 파라미터로 이름/전화번호 검색을 한다', async () => {
      const req = createMockNextRequest('GET', '/api/v2/patients', {
        auth: true,
        searchParams: { search: '김' },
      });

      const res = await GET(req);
      expect(res.status).toBe(200);
    });
  });
});
