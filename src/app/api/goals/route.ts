// src/app/api/goals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

interface GoalData {
  year: number;
  month: number;
  newPatientsTarget: number;
  appointmentsTarget: number;
  createdAt: Date;
  updatedAt: Date;
}

// 이전 월의 목표를 찾는 헬퍼 함수
async function findPreviousMonthGoal(db: any, currentYear: number, currentMonth: number) {
  // 최대 12개월 전까지 역순으로 검색
  for (let i = 1; i <= 12; i++) {
    let searchYear = currentYear;
    let searchMonth = currentMonth - i;
    
    // 월이 0 이하가 되면 이전 년도로
    if (searchMonth <= 0) {
      searchYear = currentYear - Math.ceil(Math.abs(searchMonth) / 12);
      searchMonth = 12 + (searchMonth % 12);
      if (searchMonth === 0) searchMonth = 12;
    }
    
    const previousGoal = await db.collection('goals').findOne({
      year: searchYear,
      month: searchMonth
    });
    
    if (previousGoal) {
      console.log(`🔍 이전 목표 발견: ${searchYear}년 ${searchMonth}월 - 신규환자: ${previousGoal.newPatientsTarget}, 예약: ${previousGoal.appointmentsTarget}`);
      return {
        newPatientsTarget: previousGoal.newPatientsTarget,
        appointmentsTarget: previousGoal.appointmentsTarget
      };
    }
  }
  
  // 이전 목표가 없으면 기본값 반환
  console.log('🎯 이전 목표를 찾을 수 없어 기본값 사용');
  return {
    newPatientsTarget: 30,
    appointmentsTarget: 50
  };
}

// GET: 현재 월의 목표 조회
export async function GET() {
  try {
    const { client, db } = await connectToDatabase();
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    console.log(`📅 목표 조회 요청: ${currentYear}년 ${currentMonth}월`);
    
    // 현재 월의 목표 조회
    const goal = await db.collection('goals').findOne({
      year: currentYear,
      month: currentMonth
    });
    
    if (goal) {
      console.log(`✅ 현재 월 목표 발견: 신규환자 ${goal.newPatientsTarget}명, 예약 ${goal.appointmentsTarget}건`);
      return NextResponse.json({
        success: true,
        data: {
          newPatientsTarget: goal.newPatientsTarget,
          appointmentsTarget: goal.appointmentsTarget,
          year: goal.year,
          month: goal.month,
          updatedAt: goal.updatedAt,
          isInherited: false // 현재 월에 직접 설정된 목표
        }
      });
    } else {
      // 🔥 현재 월 목표가 없으면 이전 월 목표를 상속
      console.log(`❌ 현재 월 목표 없음. 이전 월 목표 검색 중...`);
      
      const inheritedGoal = await findPreviousMonthGoal(db, currentYear, currentMonth);
      
      // 🎯 새로운 전략: 이전 목표를 현재 월에 자동으로 생성
      const newGoalData = {
        year: currentYear,
        month: currentMonth,
        newPatientsTarget: inheritedGoal.newPatientsTarget,
        appointmentsTarget: inheritedGoal.appointmentsTarget,
        createdAt: new Date(),
        updatedAt: new Date(),
        inheritedFrom: 'previous_month' // 상속 표시
      };
      
      // 현재 월에 상속받은 목표를 자동 생성
      await db.collection('goals').insertOne(newGoalData);
      
      console.log(`🔄 목표 상속 완료: 신규환자 ${inheritedGoal.newPatientsTarget}명, 예약 ${inheritedGoal.appointmentsTarget}건`);
      
      return NextResponse.json({
        success: true,
        data: {
          newPatientsTarget: inheritedGoal.newPatientsTarget,
          appointmentsTarget: inheritedGoal.appointmentsTarget,
          year: currentYear,
          month: currentMonth,
          updatedAt: newGoalData.updatedAt,
          isInherited: true // 이전 월에서 상속받은 목표
        }
      });
    }
  } catch (error) {
    console.error('목표 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '목표 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 목표 저장/업데이트
export async function POST(request: NextRequest) {
  try {
    const { newPatientsTarget, appointmentsTarget, year, month } = await request.json();
    
    // 입력값 검증
    if (!newPatientsTarget || !appointmentsTarget) {
      return NextResponse.json(
        { success: false, error: '목표값이 누락되었습니다.' },
        { status: 400 }
      );
    }
    
    const { client, db } = await connectToDatabase();
    
    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || new Date().getMonth() + 1;
    
    console.log(`💾 목표 저장 요청: ${targetYear}년 ${targetMonth}월 - 신규환자: ${newPatientsTarget}, 예약: ${appointmentsTarget}`);
    
    // 기존 목표가 있는지 확인
    const existingGoal = await db.collection('goals').findOne({
      year: targetYear,
      month: targetMonth
    });
    
    const goalData: Partial<GoalData> = {
      year: targetYear,
      month: targetMonth,
      newPatientsTarget: parseInt(newPatientsTarget),
      appointmentsTarget: parseInt(appointmentsTarget),
      updatedAt: new Date()
    };
    
    let result;
    
    if (existingGoal) {
      // 기존 목표 업데이트 (inheritedFrom 필드 제거 - 사용자가 직접 설정)
      result = await db.collection('goals').updateOne(
        { year: targetYear, month: targetMonth },
        { 
          $set: goalData,
          $unset: { inheritedFrom: "" } // 상속 표시 제거
        }
      );
      console.log(`🔄 기존 목표 업데이트 완료`);
    } else {
      // 새 목표 생성
      goalData.createdAt = new Date();
      result = await db.collection('goals').insertOne(goalData);
      console.log(`🆕 새 목표 생성 완료`);
    }
    
    return NextResponse.json({
      success: true,
      message: existingGoal ? '목표가 업데이트되었습니다.' : '새 목표가 설정되었습니다.',
      data: goalData
    });
    
  } catch (error) {
    console.error('목표 저장 오류:', error);
    return NextResponse.json(
      { success: false, error: '목표 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// PUT: 특정 월의 목표 업데이트 (관리용) - 기존 코드 유지
export async function PUT(request: NextRequest) {
  try {
    const { newPatientsTarget, appointmentsTarget, year, month } = await request.json();
    
    if (!year || !month || !newPatientsTarget || !appointmentsTarget) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }
    
    const { client, db } = await connectToDatabase();
    
    const result = await db.collection('goals').updateOne(
      { year: parseInt(year), month: parseInt(month) },
      { 
        $set: {
          newPatientsTarget: parseInt(newPatientsTarget),
          appointmentsTarget: parseInt(appointmentsTarget),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    
    return NextResponse.json({
      success: true,
      message: '목표가 업데이트되었습니다.',
      modified: result.modifiedCount,
      upserted: result.upsertedCount
    });
    
  } catch (error) {
    console.error('목표 업데이트 오류:', error);
    return NextResponse.json(
      { success: false, error: '목표 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 특정 월의 목표 삭제 (관리용) - 기존 코드 유지
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    
    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: '년도와 월이 필요합니다.' },
        { status: 400 }
      );
    }
    
    const { client, db } = await connectToDatabase();
    
    const result = await db.collection('goals').deleteOne({
      year: parseInt(year),
      month: parseInt(month)
    });
    
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: '삭제할 목표를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: '목표가 삭제되었습니다.',
      deleted: result.deletedCount
    });
    
  } catch (error) {
    console.error('목표 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: '목표 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}