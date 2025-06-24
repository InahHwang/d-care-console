// src/app/api/reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || 
                  request.cookies.get('token')?.value ||
                  request.headers.get('cookie')?.split('token=')[1]?.split(';')[0];

    if (!token) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    const decoded = jwt.decode(token) as any;
    if (!decoded) {
      return NextResponse.json({ message: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const reportsCollection = db.collection('reports');

    // 보고서 목록 조회 (최신순)
    const reports = await reportsCollection
      .find({}, {
        projection: {
          _id: 1,
          month: 1,
          year: 1,
          status: 1,
          createdBy: 1,
          createdByName: 1,
          createdAt: 1,
          updatedAt: 1
        }
      })
      .sort({ year: -1, month: -1, createdAt: -1 })
      .toArray();

    return NextResponse.json({ 
      success: true, 
      reports: reports.map((report: { _id: { toString: () => any; }; }) => ({
        ...report,
        _id: report._id.toString()
      }))
    });

  } catch (error) {
    console.error('보고서 목록 조회 오류:', error);
    return NextResponse.json(
      { message: '보고서 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || 
                  request.cookies.get('token')?.value ||
                  request.headers.get('cookie')?.split('token=')[1]?.split(';')[0];

    if (!token) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    const decoded = jwt.decode(token) as any;
    if (!decoded) {
      return NextResponse.json({ message: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    const { month, year } = await request.json();

    if (!month || !year) {
      return NextResponse.json({ message: '월과 년도를 입력해주세요.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const reportsCollection = db.collection('reports');

    // 동일한 월/년도 보고서가 이미 있는지 확인
    const existingReport = await reportsCollection.findOne({ month, year });
    if (existingReport) {
      return NextResponse.json({ 
        message: `${year}년 ${month}월 보고서가 이미 존재합니다.`,
        reportId: existingReport._id.toString()
      }, { status: 409 });
    }

    // 월별 통계 데이터 조회 (monthly API 사용)
    const statsResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/reports/monthly`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ month, year })
    });

    if (!statsResponse.ok) {
      throw new Error('월별 통계 데이터를 불러오는데 실패했습니다.');
    }

    const { stats } = await statsResponse.json();

    // 새 보고서 생성
    const newReport = {
      month,
      year,
      generatedDate: new Date().toISOString().split('T')[0],
      createdBy: decoded._id || decoded.id,
      createdByName: decoded.name || decoded.username,
      status: 'draft',
      
      // 통계 데이터
      ...stats,
      
      // 매니저 입력 데이터 (빈 값으로 초기화)
      managerComment: '',
      improvementSuggestions: '',
      managerAnswers: {
        question1: '',
        question2: '',
        question3: ''
      },
      
      // 메타데이터
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const result = await reportsCollection.insertOne(newReport);

    const createdReport = {
      ...newReport,
      _id: result.insertedId.toString()
    };

    return NextResponse.json({ 
      success: true, 
      report: createdReport,
      message: '보고서가 생성되었습니다.'
    });

  } catch (error) {
    console.error('보고서 생성 오류:', error);
    return NextResponse.json(
      { message: '보고서 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}