const { MongoClient } = require('mongodb');

async function checkPatient() {
  const uri = 'mongodb+srv://dsbrdent:2JMvdx1pQB08PZBa@d-care-cluster.r4dwbxo.mongodb.net/d-care-db?retryWrites=true&w=majority&appName=d-care-cluster';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('d-care-db');

    // 신성호 환자 검색
    const patient = await db.collection('patients').findOne({ name: '신성호' });

    if (patient) {
      console.log('=== 신성호 환자 데이터 ===');
      console.log('_id:', patient._id.toString());
      console.log('name:', patient.name);
      console.log('callInDate:', patient.callInDate);
      console.log('');
      console.log('=== consultation 필드 ===');
      console.log(JSON.stringify(patient.consultation, null, 2));
    } else {
      console.log('신성호 환자를 찾을 수 없습니다.');

      // 비슷한 이름 검색
      const similar = await db.collection('patients').find({
        name: { $regex: '신성', $options: 'i' }
      }).toArray();
      console.log('비슷한 이름:', similar.map(p => p.name));
    }
  } catch (error) {
    console.error('오류:', error.message);
  } finally {
    await client.close();
  }
}

checkPatient();
