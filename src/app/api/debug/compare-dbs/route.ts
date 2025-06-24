// src/app/api/debug/compare-dbs/route.ts
import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const PROD_URI = process.env.MONGODB_URI!; // d-care-db
const DEV_URI = PROD_URI.replace('d-care-db', 'd-care-development'); // d-care-development

export async function GET() {
  let prodClient: MongoClient | null = null;
  let devClient: MongoClient | null = null;

  try {
    // 두 DB에 연결
    prodClient = new MongoClient(PROD_URI);
    devClient = new MongoClient(DEV_URI);
    
    await Promise.all([
      prodClient.connect(),
      devClient.connect()
    ]);

    const prodDb = prodClient.db();
    const devDb = devClient.db();

    // 컬렉션 목록 비교
    const [prodCollections, devCollections] = await Promise.all([
      prodDb.listCollections().toArray(),
      devDb.listCollections().toArray()
    ]);

    const prodCollNames = prodCollections.map(c => c.name).sort();
    const devCollNames = devCollections.map(c => c.name).sort();

    // 각 컬렉션의 문서 수 비교
    const uniqueCollections = Array.from(new Set([...prodCollNames, ...devCollNames]));
    const collectionComparison = await Promise.all(
      uniqueCollections.map(async (collName) => {
        try {
          const [prodCount, devCount] = await Promise.all([
            prodCollNames.includes(collName) ? prodDb.collection(collName).countDocuments() : 0,
            devCollNames.includes(collName) ? devDb.collection(collName).countDocuments() : 0
          ]);

          return {
            collection: collName,
            production: prodCount,
            development: devCount,
            difference: devCount - prodCount,
            status: prodCount === 0 && devCount > 0 ? 'dev-only' :
                   devCount === 0 && prodCount > 0 ? 'prod-only' :
                   devCount > prodCount ? 'dev-has-more' :
                   prodCount > devCount ? 'prod-has-more' : 'equal'
          };
        } catch (error: any) {
          return {
            collection: collName,
            error: error?.message,
            status: 'error'
          };
        }
      })
    );

    // 요약 통계
    const summary = {
      production: {
        database: 'd-care-db',
        collections: prodCollNames.length,
        totalDocuments: collectionComparison
          .filter(c => c.production)
          .reduce((sum, c) => sum + (c.production || 0), 0)
      },
      development: {
        database: 'd-care-development', 
        collections: devCollNames.length,
        totalDocuments: collectionComparison
          .filter(c => c.development)
          .reduce((sum, c) => sum + (c.development || 0), 0)
      },
      differences: {
        devOnlyCollections: collectionComparison.filter(c => c.status === 'dev-only').length,
        prodOnlyCollections: collectionComparison.filter(c => c.status === 'prod-only').length,
        collectionsWithMoreDataInDev: collectionComparison.filter(c => c.status === 'dev-has-more').length,
        collectionsWithMoreDataInProd: collectionComparison.filter(c => c.status === 'prod-has-more').length
      }
    };

    return NextResponse.json({
      summary,
      collectionComparison,
      recommendations: generateRecommendations(collectionComparison, summary),
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('DB Comparison Error:', error);
    return NextResponse.json({
      error: 'Database comparison failed',
      details: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    // 연결 정리
    if (prodClient) await prodClient.close();
    if (devClient) await devClient.close();
  }
}

function generateRecommendations(comparison: any[], summary: any) {
  const recommendations = [];

  if (summary.development.totalDocuments > summary.production.totalDocuments) {
    recommendations.push('개발 DB에 더 많은 데이터가 있습니다. 최신 작업 내용을 운영 DB로 마이그레이션해야 할 수 있습니다.');
  }

  const devOnlyCollections = comparison.filter(c => c.status === 'dev-only');
  if (devOnlyCollections.length > 0) {
    recommendations.push(`개발 DB에만 있는 컬렉션: ${devOnlyCollections.map(c => c.collection).join(', ')}`);
  }

  const devHasMore = comparison.filter(c => c.status === 'dev-has-more');
  if (devHasMore.length > 0) {
    recommendations.push(`개발 DB에 더 많은 데이터가 있는 컬렉션: ${devHasMore.map(c => c.collection).join(', ')}`);
  }

  return recommendations;
}