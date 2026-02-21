// scripts/update-missed-calls.js
// 기존 부재중 통화들을 "부재중"으로 분류

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function updateMissedCalls() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI가 설정되지 않았습니다.');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('MongoDB 연결 성공');

    const db = client.db();

    // 먼저 부재중 통화 (duration=0) 중 unknown이거나 classification이 없는 것 확인
    const missedCalls = await db.collection('callLogs_v2').find({
      duration: 0,
      $or: [
        { 'aiAnalysis.classification': 'unknown' },
        { 'aiAnalysis.classification': { $exists: false } },
        { 'aiAnalysis.classification': null },
        { aiAnalysis: null },
        { aiAnalysis: { $exists: false } }
      ]
    }).toArray();

    console.log('부재중 통화 중 분류가 unknown이거나 없는 것:', missedCalls.length, '건');

    if (missedCalls.length > 0) {
      console.log('\n수정할 통화 목록:');
      missedCalls.forEach((call, i) => {
        console.log(`${i + 1}. ${call.phone} - 현재 분류: ${call.aiAnalysis?.classification || 'null'}`);
      });

      // 일괄 업데이트
      const result = await db.collection('callLogs_v2').updateMany(
        {
          duration: 0,
          $or: [
            { 'aiAnalysis.classification': 'unknown' },
            { 'aiAnalysis.classification': { $exists: false } },
            { 'aiAnalysis.classification': null },
            { aiAnalysis: null },
            { aiAnalysis: { $exists: false } }
          ]
        },
        [
          {
            $set: {
              aiStatus: 'completed',
              aiAnalysis: {
                $mergeObjects: [
                  { $ifNull: ['$aiAnalysis', {}] },
                  { classification: '부재중', summary: '부재중 통화' }
                ]
              },
              updatedAt: new Date().toISOString()
            }
          }
        ]
      );

      console.log('\n업데이트 완료:', result.modifiedCount, '건 수정됨');
    } else {
      console.log('수정할 통화가 없습니다.');
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await client.close();
    console.log('MongoDB 연결 종료');
  }
}

updateMissedCalls();
