// src/app/api/patients/status-filter/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filterType = searchParams.get('type');

    if (!filterType) {
      return NextResponse.json(
        { error: '필터 타입이 필요합니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    
    // 현재 날짜 계산
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    // 이번 달 시작일 계산
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    let filter = {};
    
    switch (filterType) {
      case 'callbackNeeded':
        // 콜백이 필요한 환자: 상태가 '콜백필요'인 환자
        filter = { status: '콜백필요' };
        break;
        
      case 'absent':
        // 부재중 환자: 상태가 '부재중'인 환자
        filter = { status: '부재중' };
        break;
        
      case 'todayScheduled':
        // 오늘 예정된 콜백: nextCallbackDate가 오늘인 환자들
        filter = {
          nextCallbackDate: {
            $gte: todayStart.toISOString(),
            $lt: todayEnd.toISOString()
          }
        };
        break;
        
      case 'newPatients':
        // 이번달 신규 환자: createdAt이 이번 달인 환자들
        filter = {
          createdAt: {
            $gte: thisMonthStart.toISOString()
          }
        };
        break;
        
      default:
        return NextResponse.json(
          { error: '유효하지 않은 필터 타입입니다.' },
          { status: 400 }
        );
    }

    // 환자 목록 조회 (종결되지 않은 환자만)
    const patients = await db.collection('patients')
      .find({
        ...filter,
        $or: [
          { isCompleted: { $ne: true } },
          { isCompleted: { $exists: false } }
        ]
      })
      .sort({ updatedAt: -1 })
      .toArray();

    // MongoDB ObjectId를 문자열로 변환
    const processedPatients = patients.map((patient: { _id: { toString: () => any; }; }) => ({
      ...patient,
      _id: patient._id.toString()
    }));

    console.log(`[API] ${filterType} 필터로 ${processedPatients.length}명의 환자를 조회했습니다.`);

    return NextResponse.json(processedPatients);

  } catch (error) {
    console.error('[API] 환자 상태별 필터링 오류:', error);
    return NextResponse.json(
      { 
        error: '서버 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}