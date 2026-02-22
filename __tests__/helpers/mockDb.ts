// __tests__/helpers/mockDb.ts
// MongoDB mock 유틸리티

type Doc = Record<string, any>;

/**
 * 체이너블 MongoDB 커서를 흉내내는 mock.
 * find().sort().skip().limit().toArray() 패턴을 지원한다.
 */
function createChainableCursor(docs: Doc[]) {
  let _sorted: Doc[] = [...docs];
  let _skip = 0;
  let _limit = Infinity;
  let _projection: Record<string, number> | null = null;

  const cursor = {
    sort: jest.fn().mockImplementation(() => cursor),
    skip: jest.fn().mockImplementation((n: number) => { _skip = n; return cursor; }),
    limit: jest.fn().mockImplementation((n: number) => { _limit = n; return cursor; }),
    project: jest.fn().mockImplementation(() => cursor),
    toArray: jest.fn().mockImplementation(async () => {
      return _sorted.slice(_skip, _skip + _limit);
    }),
  };
  return cursor;
}

/**
 * mock MongoDB Collection 생성.
 * 초기 데이터를 제공하면 find/findOne에서 사용한다.
 */
export function createMockCollection(initialData: Doc[] = []) {
  const data = [...initialData];

  const collection = {
    find: jest.fn().mockImplementation((_filter?: any, _opts?: any) => {
      return createChainableCursor(data);
    }),

    findOne: jest.fn().mockImplementation(async (filter?: any) => {
      if (!filter) return data[0] || null;
      // 간단한 clinicId 매칭만 지원 (테스트용)
      return data.find((d) => {
        if (filter.clinicId && d.clinicId !== filter.clinicId) return false;
        if (filter._id) {
          const idStr = typeof filter._id === 'string' ? filter._id : filter._id.toString();
          const docId = typeof d._id === 'string' ? d._id : d._id?.toString?.();
          if (idStr !== docId) return false;
        }
        return true;
      }) || null;
    }),

    insertOne: jest.fn().mockImplementation(async (doc: Doc) => {
      const insertedId = doc._id || 'mock-inserted-id-' + Date.now();
      data.push({ ...doc, _id: insertedId });
      return { insertedId, acknowledged: true };
    }),

    updateOne: jest.fn().mockImplementation(async () => ({
      matchedCount: 1, modifiedCount: 1, acknowledged: true,
    })),

    updateMany: jest.fn().mockImplementation(async () => ({
      matchedCount: 0, modifiedCount: 0, acknowledged: true,
    })),

    findOneAndUpdate: jest.fn().mockImplementation(async (_filter: any, _update: any) => ({
      _id: 'mock-id', ...(_update?.$set || {}),
    })),

    deleteOne: jest.fn().mockImplementation(async () => ({
      deletedCount: 1, acknowledged: true,
    })),

    countDocuments: jest.fn().mockImplementation(async () => data.length),

    aggregate: jest.fn().mockImplementation(() => ({
      toArray: jest.fn().mockResolvedValue([]),
    })),

    distinct: jest.fn().mockImplementation(async () => []),
  };

  return collection;
}

/**
 * mock DB 객체 생성.
 * collections: { 이름: mock컬렉션 } 맵.
 */
export function createMockDb(collections: Record<string, ReturnType<typeof createMockCollection>> = {}) {
  return {
    collection: jest.fn().mockImplementation((name: string) => {
      if (!collections[name]) {
        collections[name] = createMockCollection();
      }
      return collections[name];
    }),
  };
}

/**
 * connectToDatabase를 mock으로 교체.
 * jest.mock('@/utils/mongodb') 한 뒤 이 함수로 설정.
 */
export function setupMockMongodb(mockDb: ReturnType<typeof createMockDb>) {
  const mongodb = require('@/utils/mongodb');
  (mongodb.connectToDatabase as jest.Mock).mockResolvedValue({ db: mockDb });
  return mongodb;
}
