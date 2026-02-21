const { MongoClient } = require('mongodb');

async function check() {
  const client = new MongoClient('mongodb+srv://inahbob:RDx8rCQGWAbxApxi@cluster0.qi7r8.mongodb.net/d-care?retryWrites=true&w=majority');
  await client.connect();
  const db = client.db('d-care');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const phones = ['3655', '5432', '1669'];

  for (const phone of phones) {
    console.log('='.repeat(60));
    console.log('전화번호 끝자리:', phone);

    const callLog = await db.collection('callLogs_v2').findOne(
      {
        phone: { $regex: phone + '$' },
        startedAt: { $gte: today }
      },
      { sort: { startedAt: -1 } }
    );

    if (callLog) {
      console.log('ID:', callLog._id.toString());
      console.log('phone:', callLog.phone);
      console.log('direction:', callLog.direction);
      console.log('status:', callLog.status);
      console.log('duration:', callLog.duration);
      console.log('aiStatus:', callLog.aiStatus);
      console.log('recordingUrl:', callLog.recordingUrl || '없음');
      console.log('startedAt:', callLog.startedAt);
      console.log('aiAnalysis 있음:', !!callLog.aiAnalysis);
      if (callLog.aiAnalysis) {
        console.log('  classification:', callLog.aiAnalysis.classification);
        console.log('  summary:', (callLog.aiAnalysis.summary || '').substring(0, 100));
      }
    } else {
      console.log('통화기록 없음');
    }
  }

  await client.close();
}

check().catch(console.error);
