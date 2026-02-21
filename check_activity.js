const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  
  const db = client.db('d-care-db');
  const patients = db.collection('patients_v2');
  const activityLogs = db.collection('activityLogs');
  
  const names = ['이정수', '최승원', '박덕양'];
  
  for (const name of names) {
    const patient = await patients.findOne({ name });
    if (patient) {
      console.log(`\n=== ${name} (${patient._id}) ===`);
      
      // 활동 로그 확인
      const logs = await activityLogs.find({ 
        patientId: patient._id.toString()
      }).sort({ timestamp: -1 }).toArray();
      
      if (logs.length > 0) {
        console.log('활동 로그:');
        for (const log of logs) {
          console.log(`  - ${log.timestamp} | ${log.action} | ${log.userName}`);
        }
      } else {
        console.log('활동 로그 없음');
        
        // 이름으로 검색
        const logsByName = await activityLogs.find({ 
          $or: [
            { patientName: name },
            { 'details.patientName': name }
          ]
        }).toArray();
        
        if (logsByName.length > 0) {
          console.log('이름 검색 활동 로그:');
          for (const log of logsByName) {
            console.log(`  - ${log.timestamp} | ${log.action} | ${log.userName}`);
          }
        }
      }
    }
  }
  
  await client.close();
}

main().catch(console.error);
