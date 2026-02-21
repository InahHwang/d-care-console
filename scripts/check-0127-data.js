const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  // 2026-01-27 (API 방식으로 조회)
  const startOfDay = '2026-01-27T00:00:00.000Z';
  const endOfDay = '2026-01-27T23:59:59.999Z';

  console.log('=== 2026-01-27 데이터 (API 방식) ===\n');

  // callLogs_v2 - createdAt 사용
  const callLogs = await db.collection('callLogs_v2').find({
    createdAt: { $gte: new Date(startOfDay), $lte: new Date(endOfDay) },
    aiStatus: 'completed'
  }).toArray();

  console.log('callLogs_v2 (createdAt, aiStatus=completed):', callLogs.length, '건');
  callLogs.forEach(c => {
    console.log('  -', c._id.toString(), '| patientId:', c.patientId || 'null', '| phone:', c.phone);
  });

  // consultations_v2
  const consultations = await db.collection('consultations_v2').find({
    date: { $gte: new Date(startOfDay), $lte: new Date(endOfDay) }
  }).toArray();
  console.log('\nconsultations_v2:', consultations.length, '건');

  // manualConsultations_v2
  const manualConsultations = await db.collection('manualConsultations_v2').find({
    date: { $gte: new Date(startOfDay), $lte: new Date(endOfDay) }
  }).toArray();
  console.log('manualConsultations_v2:', manualConsultations.length, '건');

  // 환자 존재 여부 확인
  const patientIds = new Set();
  callLogs.forEach(c => c.patientId && patientIds.add(c.patientId));
  consultations.forEach(c => c.patientId && patientIds.add(c.patientId));
  manualConsultations.forEach(c => c.patientId && patientIds.add(c.patientId));

  console.log('\n=== 환자 존재 여부 ===');
  for (const pid of patientIds) {
    try {
      const patient = await db.collection('patients_v2').findOne({ _id: new ObjectId(pid) });
      console.log(' ', pid, ':', patient ? 'O (' + patient.name + ')' : 'X (삭제됨)');
    } catch (e) {
      console.log(' ', pid, ': 잘못된 ID');
    }
  }

  await client.close();
}
check();
