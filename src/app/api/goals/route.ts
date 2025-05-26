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

// GET: 현재 월의 목표 조회
export async function GET() {
  try {
    const { client, db } = await connectToDatabase();
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // 현재 월의 목표 조회
    const goal = await db.collection('goals').findOne({
      year: currentYear,
      month: currentMonth
    });
    
    if (goal) {
      return NextResponse.json({
        success: true,
        data: {
          newPatientsTarget: goal.newPatientsTarget,
          appointmentsTarget: goal.appointmentsTarget,
          year: goal.year,
          month: goal.month,
          updatedAt: goal.updatedAt
        }
      });
    } else {
      // 목표가 없으면 기본값 반환
      return NextResponse.json({
        success: true,
        data: {
          newPatientsTarget: 30,
          appointmentsTarget: 50,
          year: currentYear,
          month: currentMonth,
          updatedAt: null
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
      // 기존 목표 업데이트
      result = await db.collection('goals').updateOne(
        { year: targetYear, month: targetMonth },
        { $set: goalData }
      );
    } else {
      // 새 목표 생성
      goalData.createdAt = new Date();
      result = await db.collection('goals').insertOne(goalData);
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

// PUT: 특정 월의 목표 업데이트 (관리용)
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

// DELETE: 특정 월의 목표 삭제 (관리용)
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