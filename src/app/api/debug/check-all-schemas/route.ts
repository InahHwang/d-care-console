// src/app/api/debug/check-all-schemas/route.ts
import connectDB from '@/utils/mongodb';

export async function GET() {
  try {
    const client = await connectDB;
    const db = client.db(); // 또는 client.db('your-database-name')
    
    // 모든 컬렉션 이름 가져오기
    const collections = await db.listCollections().toArray();
    const result: any = {};
    
    for (const collection of collections) {
      const collectionName = collection.name;
      
      // 각 컬렉션에서 샘플 데이터 1개씩 가져오기
      const sampleDoc = await db.collection(collectionName).findOne();
      
      if (sampleDoc) {
        result[collectionName] = {
          fields: Object.keys(sampleDoc),
          sampleData: sampleDoc,
          count: await db.collection(collectionName).countDocuments(),
          fieldTypes: Object.entries(sampleDoc).reduce((acc: any, [key, value]) => {
            acc[key] = {
              type: typeof value,
              isArray: Array.isArray(value),
              isNull: value === null,
              isUndefined: value === undefined
            };
            return acc;
          }, {})
        };
      }
    }
    
    return Response.json({
      collections: result,
      summary: {
        totalCollections: collections.length,
        collectionNames: collections.map((c: any) => c.name)
      }
    });
    
  } catch (error: any) {
    return Response.json({ 
      error: error.message || 'Unknown error',
      stack: error.stack || 'No stack trace'
    }, { status: 500 });
  }
}