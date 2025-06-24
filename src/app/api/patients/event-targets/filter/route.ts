//src/app/api/patients/evet-targets/filter/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

// Dynamic server usage를 명시적으로 허용 (Vercel 배포 에러 해결)
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    
    // URL에서 필터 파라미터 추출
    const url = new URL(request.url);
    const categories = url.searchParams.getAll('category');
    const reasons = url.searchParams.getAll('reason');
    
    console.log('이벤트 타겟 필터링:', { categories, reasons });
    
    // 기본 쿼리 - 이벤트 타겟으로 지정된 환자
    const query: any = {
      'eventTargetInfo.isEventTarget': true
    };
    
    // 카테고리 필터 적용
    if (categories && categories.length > 0) {
      query['eventTargetInfo.categories'] = { $in: categories };
    }
    
    // 타겟 사유 필터 적용
    if (reasons && reasons.length > 0) {
      query['eventTargetInfo.targetReason'] = { $in: reasons };
    }
    
    // 필터링된 환자 조회
    const filteredPatients = await db.collection('patients')
      .find(query)
      .toArray();
    
    // ObjectId를 문자열로 변환하고 id 필드 설정
    const formattedPatients = filteredPatients.map((patient: any) => {
      const formattedPatient = { ...patient };
      
      if (formattedPatient._id) {
        formattedPatient._id = formattedPatient._id.toString();
        
        // id 필드가 없으면 _id로 설정
        if (!formattedPatient.id) {
          formattedPatient.id = formattedPatient._id;
        }
      }
      
      return formattedPatient;
    });
    
    return NextResponse.json(formattedPatients, { status: 200 });
  } catch (error) {
    console.error('이벤트 타겟 필터링 실패:', error);
    return NextResponse.json({ error: '이벤트 타겟 필터링에 실패했습니다.' }, { status: 500 });
  }
}