// src/app/api/debug/data-analysis/route.ts
import { NextResponse } from 'next/server';
import connectDB from '@/utils/mongodb';

export async function GET() {
  try {
    const client = await connectDB;
    const db = client.db();

    // 각 컬렉션의 상세 분석
    const collections = ['users', 'patients', 'goals', 'categories', 'templates', 'activityLogs', 'messageLogs'];
    
    const analysisResults = await Promise.all(
      collections.map(async (collectionName) => {
        try {
          const collection = db.collection(collectionName);
          
          // 기본 통계
          const totalCount = await collection.countDocuments();
          
          if (totalCount === 0) {
            return {
              collection: collectionName,
              totalCount: 0,
              status: 'empty'
            };
          }

          // 최신/오래된 문서
          const newest = await collection.findOne({}, { sort: { createdAt: -1 } });
          const oldest = await collection.findOne({}, { sort: { createdAt: 1 } });
          
          // 샘플 문서 (민감한 정보 제외)
          const samples = await collection.find({}, { 
            limit: 3,
            projection: collectionName === 'users' 
              ? { username: 1, role: 1, createdAt: 1 }
              : collectionName === 'patients'
              ? { name: 1, phone: 1, status: 1, createdAt: 1 }
              : { createdAt: 1, updatedAt: 1 }
          }).toArray();

          // 날짜별 분포 (최근 30일)
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          const recentCount = await collection.countDocuments({
            createdAt: { $gte: thirtyDaysAgo }
          });

          return {
            collection: collectionName,
            totalCount,
            recentCount,
            newestDate: newest?.createdAt,
            oldestDate: oldest?.createdAt,
            samples: samples.map(doc => ({
              id: doc._id,
              ...doc
            })),
            status: 'active'
          };

        } catch (error: any) {
          return {
            collection: collectionName,
            error: error?.message || 'Collection analysis failed',
            status: 'error'
          };
        }
      })
    );

    // 전체 요약
    const summary = {
      totalCollections: analysisResults.length,
      activeCollections: analysisResults.filter(r => r.status === 'active').length,
      emptyCollections: analysisResults.filter(r => r.status === 'empty').length,
      errorCollections: analysisResults.filter(r => r.status === 'error').length,
      totalDocuments: analysisResults
        .filter(r => r.totalCount)
        .reduce((sum, r) => sum + (r.totalCount || 0), 0)
    };

    return NextResponse.json({
      summary,
      collections: analysisResults,
      dbInfo: {
        dbName: db.databaseName,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Data Analysis Error:', error);
    return NextResponse.json({
      error: 'Data analysis failed',
      details: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}