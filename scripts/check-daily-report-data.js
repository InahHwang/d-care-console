const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function checkDailyReportData() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    // 2026-01-27 날짜 범위 (오늘 기준 어제)
    const startOfDay = new Date('2026-01-27T00:00:00+09:00');
    const endOfDay = new Date('2026-01-27T23:59:59+09:00');

    console.log('=== 2026-01-27 일별 보고서 데이터 확인 ===\n');
    console.log('조회 범위:', startOfDay.toISOString(), '~', endOfDay.toISOString(), '\n');

    // 1. consultations_v2 확인
    const consultations = await db.collection('consultations_v2').find({
      date: { $gte: startOfDay, $lte: endOfDay }
    }).toArray();
    console.log('consultations_v2:', consultations.length, '건');
    consultations.forEach(c => {
      console.log('  -', c._id, '| patientId:', c.patientId, '| status:', c.status);
    });

    // 2. manualConsultations_v2 확인
    const manualConsultations = await db.collection('manualConsultations_v2').find({
      date: { $gte: startOfDay, $lte: endOfDay }
    }).toArray();
    console.log('\nmanualConsultations_v2:', manualConsultations.length, '건');
    manualConsultations.forEach(mc => {
      console.log('  -', mc._id, '| patientId:', mc.patientId, '| status:', mc.status);
    });

    // 3. callLogs_v2에서 신환 통화 확인
    const callLogs = await db.collection('callLogs_v2').find({
      startedAt: { $gte: startOfDay, $lte: endOfDay },
      'aiAnalysis.classification': '신환'
    }).toArray();
    console.log('\ncallLogs_v2 (신환):', callLogs.length, '건');
    callLogs.forEach(cl => {
      console.log('  -', cl._id, '| patientId:', cl.patientId || 'null', '| phone:', cl.phone, '| name:', cl.aiAnalysis?.patientName || 'unknown');
    });

    // 4. 모든 callLogs_v2 확인 (신환 외 포함)
    const allCallLogs = await db.collection('callLogs_v2').find({
      startedAt: { $gte: startOfDay, $lte: endOfDay }
    }).toArray();
    console.log('\ncallLogs_v2 (전체):', allCallLogs.length, '건');
    allCallLogs.forEach(cl => {
      console.log('  -', cl._id, '| patientId:', cl.patientId || 'null', '| classification:', cl.aiAnalysis?.classification || 'none', '| phone:', cl.phone);
    });

    // 5. 해당 patientId들의 환자 존재 여부 확인
    console.log('\n=== 환자 존재 여부 확인 ===');
    const allPatientIds = new Set();
    consultations.forEach(c => c.patientId && allPatientIds.add(c.patientId));
    manualConsultations.forEach(mc => mc.patientId && allPatientIds.add(mc.patientId));
    allCallLogs.forEach(cl => cl.patientId && allPatientIds.add(cl.patientId));

    for (const pid of allPatientIds) {
      try {
        const patient = await db.collection('patients_v2').findOne({ _id: new ObjectId(pid) });
        console.log(' ', pid + ':', patient ? 'exists (' + patient.name + ')' : 'DELETED');
      } catch (e) {
        console.log(' ', pid + ':', 'invalid ID');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkDailyReportData();
