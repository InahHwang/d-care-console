// src/app/api/reports/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: '유효하지 않은 보고서 ID입니다.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const reportsCollection = db.collection('reports');

    const report = await reportsCollection.findOne({ _id: new ObjectId(id) });

    if (!report) {
      return NextResponse.json({ message: '보고서를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      report: {
        ...report,
        _id: report._id.toString()
      }
    });

  } catch (error) {
    console.error('보고서 조회 오류:', error);
    return NextResponse.json(
      { message: '보고서 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: '유효하지 않은 보고서 ID입니다.' }, { status: 400 });
    }

    const updateData = await request.json();

    const { db } = await connectToDatabase();
    const reportsCollection = db.collection('reports');

    // 현재 보고서 조회
    const existingReport = await reportsCollection.findOne({ _id: new ObjectId(id) });
    if (!existingReport) {
      return NextResponse.json({ message: '보고서를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 권한 확인 (본인이 작성한 보고서만 수정 가능, 또는 마스터)
    if (existingReport.createdBy !== (decoded._id || decoded.id) && decoded.role !== 'master') {
      return NextResponse.json({ message: '보고서를 수정할 권한이 없습니다.' }, { status: 403 });
    }

    // 제출된 보고서는 수정 불가 (마스터 제외)
    if (existingReport.status === 'submitted' && decoded.role !== 'master') {
      return NextResponse.json({ message: '제출된 보고서는 수정할 수 없습니다.' }, { status: 400 });
    }

    // 🔥 새로 추가: 통계 데이터 새로고침 기능
    if (updateData.refreshStats === true) {
      console.log(`🔄 보고서 통계 새로고침 요청: ${existingReport.year}년 ${existingReport.month}월`);
      
      try {
        // monthly API 호출해서 최신 통계 가져오기
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const statsResponse = await fetch(`${baseUrl}/api/reports/monthly`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            month: existingReport.month, 
            year: existingReport.year 
          })
        });

        if (statsResponse.ok) {
          const { stats } = await statsResponse.json();
          console.log('✅ 새로운 통계 데이터 획득:', stats);
          
          // 기존 매니저 입력 데이터는 보존하고 통계만 업데이트
          const refreshedData = {
            ...stats,
            // 매니저 입력 데이터 보존
            managerComment: existingReport.managerComment,
            improvementSuggestions: existingReport.improvementSuggestions,
            managerAnswers: existingReport.managerAnswers,
            // 메타데이터 보존
            createdBy: existingReport.createdBy,
            createdByName: existingReport.createdByName,
            createdAt: existingReport.createdAt,
            generatedDate: existingReport.generatedDate,
            month: existingReport.month,
            year: existingReport.year,
            status: existingReport.status,
            updatedAt: new Date().toISOString()
          };

          // 보고서 전체 업데이트
          const refreshResult = await reportsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: refreshedData }
          );

          if (refreshResult.matchedCount > 0) {
            // 업데이트된 보고서 조회
            const refreshedReport = await reportsCollection.findOne({ _id: new ObjectId(id) });
            
            return NextResponse.json({ 
              success: true, 
              report: {
                ...refreshedReport,
                _id: refreshedReport!._id.toString()
              },
              message: '보고서 데이터가 최신 정보로 새로고침되었습니다.'
            });
          }
        } else {
          console.error('❌ 통계 새로고침 실패:', await statsResponse.text());
          return NextResponse.json({ 
            message: '통계 데이터 새로고침에 실패했습니다.' 
          }, { status: 500 });
        }
      } catch (refreshError) {
        console.error('❌ 통계 새로고침 중 오류:', refreshError);
        return NextResponse.json({ 
          message: '통계 새로고침 중 오류가 발생했습니다.' 
        }, { status: 500 });
      }
    }

    // 🔥 기존 로직: 일반적인 보고서 수정
    // 업데이트할 필드들 준비
    const allowedFields = [
      'managerComment',
      'improvementSuggestions', 
      'managerAnswers',
      'status'
    ];

    const updateFields: any = {
      updatedAt: new Date().toISOString()
    };

    // 허용된 필드만 업데이트
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields[field] = updateData[field];
      }
    }

    // 보고서 업데이트
    const result = await reportsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: '보고서를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 업데이트된 보고서 조회
    const updatedReport = await reportsCollection.findOne({ _id: new ObjectId(id) });

    return NextResponse.json({ 
      success: true, 
      report: {
        ...updatedReport,
        _id: updatedReport!._id.toString()
      },
      message: updateData.status === 'submitted' ? '보고서가 제출되었습니다.' : '보고서가 저장되었습니다.'
    });

  } catch (error) {
    console.error('보고서 수정 오류:', error);
    return NextResponse.json(
      { message: '보고서 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // 마스터만 삭제 가능
    if (decoded.role !== 'master') {
      return NextResponse.json({ message: '보고서를 삭제할 권한이 없습니다.' }, { status: 403 });
    }

    const { id } = params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: '유효하지 않은 보고서 ID입니다.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const reportsCollection = db.collection('reports');

    const result = await reportsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: '보고서를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: '보고서가 삭제되었습니다.'
    });

  } catch (error) {
    console.error('보고서 삭제 오류:', error);
    return NextResponse.json(
      { message: '보고서 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}