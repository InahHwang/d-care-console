// src/__tests__/mock-db.ts
// MongoDB 모킹 헬퍼 — 모든 API 테스트에서 재사용

import { ObjectId } from 'mongodb';

// 체이닝 가능한 모킹 커서
export function createMockCursor(data: any[] = []) {
  const cursor = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    project: jest.fn().mockReturnThis(),
    toArray: jest.fn().mockResolvedValue(data),
  };
  return cursor;
}

// 체이닝 가능한 aggregate 커서
export function createMockAggregateCursor(data: any[] = []) {
  return {
    toArray: jest.fn().mockResolvedValue(data),
  };
}

// 모킹 컬렉션 생성
export function createMockCollection(overrides: Record<string, any> = {}) {
  return {
    find: jest.fn().mockReturnValue(createMockCursor()),
    findOne: jest.fn().mockResolvedValue(null),
    insertOne: jest.fn().mockResolvedValue({ insertedId: new ObjectId() }),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    countDocuments: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockReturnValue(createMockAggregateCursor()),
    findOneAndUpdate: jest.fn().mockResolvedValue(null),
    indexes: jest.fn().mockResolvedValue([]),
    createIndex: jest.fn().mockResolvedValue('ok'),
    ...overrides,
  };
}

// DB + collection을 한번에 셋업하는 헬퍼
export function setupMockDb(collections: Record<string, any> = {}) {
  const mockCollections: Record<string, any> = {};

  const db = {
    collection: jest.fn((name: string) => {
      if (!mockCollections[name]) {
        mockCollections[name] = createMockCollection(collections[name] || {});
      }
      return mockCollections[name];
    }),
    listCollections: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
    command: jest.fn().mockResolvedValue({}),
  };

  // connectToDatabase 모킹
  jest.mock('@/utils/mongodb', () => ({
    connectToDatabase: jest.fn().mockResolvedValue({ db, client: {} }),
    getEnvironmentInfo: jest.fn().mockReturnValue({
      environment: 'test',
      database: 'test-db',
      isProduction: false,
    }),
  }));

  return { db, getCollection: (name: string) => mockCollections[name] };
}

// NextRequest 모킹 헬퍼
export function createMockNextRequest(
  method: string,
  url: string,
  body?: any
): Request {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}
