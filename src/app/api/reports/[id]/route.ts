// src/app/api/reports/[id]/route.ts - 개선된 버전
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

// JWT 토큰 추출 헬퍼 함수
function extractToken(request: NextRequest): string | null {
  // Authorization 헤더에서 추출
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '');
  }

  // 쿠키에서 추출
  const tokenCookie = request.cookies.get('token');
  if (tokenCookie) {
    return tokenCookie.value;
  }

  // Cookie 헤더에서 직접 추출 (fallback)
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const tokenMatch = cookieHeader.match(/token=([^;]+)/);
    if (tokenMatch) {
      return tokenMatch[1];
    }
  }

  return null;
}

// JWT 토큰 검증 헬퍼 함수
function verifyToken(token: string): any {
  try {
    // JWT_SECRET이 있다면 검증, 없다면 디코드만
    if (process.env.JWT_SECRET) {
      return jwt.verify(token, process.env.JWT_SECRET);
    } else {
      const decoded = jwt.decode(token);
      if (!decoded) {
        throw new Error('Invalid token format');
      }
      return decoded;
    }
  } catch (error) {
    console.error('JWT 검증 오류:', error);
    throw new Error('Invalid token');
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔍 Reports GET 요청 시작 - ID:', params.id);

    // 1. 토큰 추출 및 검증
    const token = extractToken(request);
    if (!token) {
      console.log('❌ 토큰이 없음');
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
      console.log('✅ 토큰 검증 성공 - 사용자:', decoded.username || decoded.id);
    } catch (error) {
      console.log('❌ 토큰 검증 실패:', error instanceof Error ? error.message : String(error));
      return NextResponse.json({ message: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    // 2. ID 유효성 검사
    const { id } = params;
    if (!ObjectId.isValid(id)) {
      console.log('❌ 유효하지 않은 ObjectId:', id);
      return NextResponse.json({ message: '유효하지 않은 보고서 ID입니다.' }, { status: 400 });
    }

    // 3. 데이터베이스 연결
    let db;
    try {
      const connection = await connectToDatabase();
      db = connection.db;
      console.log('✅ 데이터베이스 연결 성공');
    } catch (error) {
      console.error('❌ 데이터베이스 연결 실패:', error instanceof Error ? error.message : String(error));
      return NextResponse.json({ message: '데이터베이스 연결에 실패했습니다.' }, { status: 500 });
    }

    // 4. 보고서 조회
    const reportsCollection = db.collection('reports');
    
    let report;
    try {
      report = await reportsCollection.findOne({ _id: new ObjectId(id) });
      console.log('✅ 보고서 조회 완료 - 존재 여부:', !!report);
    } catch (error) {
      console.error('❌ 보고서 조회 중 오류:', error instanceof Error ? error.message : String(error));
      return NextResponse.json({ message: '보고서 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    if (!report) {
      console.log('❌ 보고서를 찾을 수 없음 - ID:', id);
      return NextResponse.json({ message: '보고서를 찾을 수 없습니다.' }, { status: 404 });
    }

    console.log('✅ 보고서 반환 성공');
    return NextResponse.json({ 
      success: true, 
      report: {
        ...report,
        _id: report._id.toString()
      }
    });

  } catch (error) {
    console.error('💥 Reports GET 전체 오류:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        message: '보고서 조회 중 예상치 못한 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔍 Reports PATCH 요청 시작 - ID:', params.id);

    // 1. 토큰 추출 및 검증
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return NextResponse.json({ message: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    // 2. ID 유효성 검사
    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: '유효하지 않은 보고서 ID입니다.' }, { status: 400 });
    }

    // 3. 요청 데이터 파싱
    let updateData;
    try {
      updateData = await request.json();
    } catch (error) {
      return NextResponse.json({ message: '잘못된 요청 데이터입니다.' }, { status: 400 });
    }

    // 4. 데이터베이스 연결
    const { db } = await connectToDatabase();
    const reportsCollection = db.collection('reports');

    // 5. 기존 보고서 조회
    const existingReport = await reportsCollection.findOne({ _id: new ObjectId(id) });
    if (!existingReport) {
      return NextResponse.json({ message: '보고서를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 🔥 새로 추가: 피드백 관련 처리
    if (updateData.feedbackAction) {
      console.log('🔥 피드백 처리 요청:', updateData.feedbackAction);
      
      // 원장님 권한 확인 (master 또는 director 역할)
      if (decoded.role !== 'master' && decoded.role !== 'director') {
        return NextResponse.json({ message: '피드백을 작성할 권한이 없습니다.' }, { status: 403 });
      }

      const currentFeedbacks = existingReport.directorFeedbacks || [];
      let updatedFeedbacks = [...currentFeedbacks];

      switch (updateData.feedbackAction) {
        case 'add':
          // 새 피드백 추가
          const newFeedback = {
            feedbackId: new ObjectId().toString(),
            content: updateData.feedbackData.content,
            targetSection: updateData.feedbackData.targetSection,
            createdAt: new Date().toISOString(),
            createdBy: decoded._id || decoded.id,
            createdByName: decoded.name || decoded.username || '원장님'
          };
          updatedFeedbacks.push(newFeedback);
          console.log('✅ 새 피드백 추가:', newFeedback.feedbackId);
          break;

        case 'update':
          // 기존 피드백 수정
          const feedbackIndex = updatedFeedbacks.findIndex(f => f.feedbackId === updateData.feedbackId);
          if (feedbackIndex === -1) {
            return NextResponse.json({ message: '수정할 피드백을 찾을 수 없습니다.' }, { status: 404 });
          }
          
          // 피드백 작성자 확인
          if (updatedFeedbacks[feedbackIndex].createdBy !== (decoded._id || decoded.id) && decoded.role !== 'master') {
            return NextResponse.json({ message: '다른 사람의 피드백을 수정할 권한이 없습니다.' }, { status: 403 });
          }
          
          updatedFeedbacks[feedbackIndex] = {
            ...updatedFeedbacks[feedbackIndex],
            content: updateData.feedbackData.content,
            updatedAt: new Date().toISOString()
          };
          console.log('✅ 피드백 수정:', updateData.feedbackId);
          break;

        case 'delete':
          // 피드백 삭제
          const deleteIndex = updatedFeedbacks.findIndex(f => f.feedbackId === updateData.feedbackId);
          if (deleteIndex === -1) {
            return NextResponse.json({ message: '삭제할 피드백을 찾을 수 없습니다.' }, { status: 404 });
          }
          
          // 피드백 작성자 확인
          if (updatedFeedbacks[deleteIndex].createdBy !== (decoded._id || decoded.id) && decoded.role !== 'master') {
            return NextResponse.json({ message: '다른 사람의 피드백을 삭제할 권한이 없습니다.' }, { status: 403 });
          }
          
          updatedFeedbacks.splice(deleteIndex, 1);
          console.log('✅ 피드백 삭제:', updateData.feedbackId);
          break;
      }

      // 피드백 업데이트
      const feedbackResult = await reportsCollection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: { 
            directorFeedbacks: updatedFeedbacks,
            updatedAt: new Date().toISOString()
          }
        }
      );

      if (feedbackResult.matchedCount > 0) {
        const updatedReport = await reportsCollection.findOne({ _id: new ObjectId(id) });
        return NextResponse.json({ 
          success: true, 
          report: {
            ...updatedReport,
            _id: updatedReport!._id.toString()
          },
          message: updateData.feedbackAction === 'add' ? '피드백이 추가되었습니다.' :
                   updateData.feedbackAction === 'update' ? '피드백이 수정되었습니다.' :
                   '피드백이 삭제되었습니다.'
        });
      }
    }

    // 6. 권한 확인
    const userId = decoded._id || decoded.id;
    if (existingReport.createdBy !== userId && decoded.role !== 'master') {
      return NextResponse.json({ message: '보고서를 수정할 권한이 없습니다.' }, { status: 403 });
    }

    // 7. 제출된 보고서 수정 제한
    if (existingReport.status === 'submitted' && decoded.role !== 'master') {
      return NextResponse.json({ message: '제출된 보고서는 수정할 수 없습니다.' }, { status: 400 });
    }

    // 8. 통계 새로고침 요청 처리
    if (updateData.refreshStats === true) {
      console.log(`🔄 보고서 통계 새로고침 요청: ${existingReport.year}년 ${existingReport.month}월`);
      
      try {
        const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000';
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
          console.log('✅ 새로운 통계 데이터 획득');
          
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

          const refreshResult = await reportsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: refreshedData }
          );

          if (refreshResult.matchedCount > 0) {
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
        console.error('❌ 통계 새로고침 중 오류:', refreshError instanceof Error ? refreshError.message : String(refreshError));
        return NextResponse.json({ 
          message: '통계 새로고침 중 오류가 발생했습니다.' 
        }, { status: 500 });
      }
    }

    // 9. 일반적인 보고서 수정
    const allowedFields = [
      'managerComment',
      'improvementSuggestions', 
      'managerAnswers',
      'status'
    ];

    const updateFields: any = {
      updatedAt: new Date().toISOString()
    };

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields[field] = updateData[field];
      }
    }

    const result = await reportsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: '보고서를 찾을 수 없습니다.' }, { status: 404 });
    }

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
    console.error('💥 Reports PATCH 전체 오류:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        message: '보고서 수정 중 예상치 못한 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      },
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
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
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
    console.error('💥 Reports DELETE 전체 오류:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        message: '보고서 삭제 중 예상치 못한 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: 500 }
    );
  }
}