// jest.setup.ts — 테스트 실행 전 환경변수 설정
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
