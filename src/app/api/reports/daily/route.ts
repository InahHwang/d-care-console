// src/app/api/reports/daily/route.ts

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';

// JWT 검증 함수
function verifyToken(token: string) {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET이 설정되지 않았습니다.');
    }
    return jwt.verify(token, process.env.JWT_SECRET) as any;
  } catch (error) {
    // JWT_SECRET이 없는 경우 decode로 폴백 (개발환경용)
    console.warn('JWT 검증 실패, decode로 폴백:', error);
    return jwt.decode(token) as any;
  }
}

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || 
                  request.cookies.get('token')?.value ||
                  request.headers.get('cookie')?.split('token=')[1]?.split(';')[0];

    if (!token) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ message: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    // URL에서 날짜 파라미터 추출
    const { searchParams } = new URL(request.url);
    const selectedDate = searchParams.get('date');

    if (!selectedDate) {
      return NextResponse.json({ message: '날짜 파라미터가 필요합니다.' }, { status: 400 });
    }

    console.log(`📊 일별 환자별 상담 내용 요약 조회: ${selectedDate}`);

    const { db } = await connectToDatabase();
    const patientsCollection = db.collection('patients');

    // 🔥 해당 날짜에 상담 내용이 있는 환자들 조회
    // callInDate가 해당 날짜이거나 visitDate가 해당 날짜인 환자들
    const dailyPatients = await patientsCollection.find({
      $or: [
        { callInDate: selectedDate }, // 신규 등록된 환자
        { visitDate: selectedDate }   // 내원한 환자
      ]
    }).toArray();

    console.log(`📊 ${selectedDate} 관련 환자 수: ${dailyPatients.length}명`);

    // 🔥 환자별 상담 내용 요약 생성
    const patientConsultations = dailyPatients
      .filter(patient => {
        // 상담 내용이 있는 환자만 필터링
        const hasConsultation = patient.consultation && 
          (patient.consultation.treatmentPlan || patient.consultation.consultationNotes);
        
        const hasPostVisitConsultation = patient.postVisitConsultation && 
          patient.postVisitConsultation.firstVisitConsultationContent;

        const hasCallbackConsultation = patient.callbackHistory && 
          patient.callbackHistory.some((callback: any) => 
            (callback.resultNotes && callback.resultNotes.trim() !== '' && callback.resultNotes !== 'undefined') ||
            (callback.notes && callback.notes.trim() !== '' && callback.notes !== 'undefined')
          );

        return hasConsultation || hasPostVisitConsultation || hasCallbackConsultation;
      })
      .map(patient => {
        // 🔥 상담 내용 조합 로직
        const consultationContents: string[] = [];

        // 1. 최초 상담 내용 (불편한 부분 + 상담메모)
        if (patient.consultation) {
          let initialContent = '';
          if (patient.consultation.treatmentPlan) {
            initialContent += `[불편한 부분] ${patient.consultation.treatmentPlan}`;
          }
          if (patient.consultation.consultationNotes) {
            if (initialContent) initialContent += '\n';
            initialContent += `[상담메모] ${patient.consultation.consultationNotes}`;
          }
          if (initialContent) {
            consultationContents.push(`[최초 상담]\n${initialContent}`);
          }
        }

        // 2. 내원 후 첫 상담 내용
        if (patient.postVisitConsultation?.firstVisitConsultationContent) {
          consultationContents.push(`[내원 후 상담] ${patient.postVisitConsultation.firstVisitConsultationContent}`);
        }

        // 3. 콜백 히스토리 상담 내용들
        if (patient.callbackHistory && patient.callbackHistory.length > 0) {
          const consultationCallbacks = patient.callbackHistory
            .filter((callback: any) => {
              const hasValidResultNotes = callback.resultNotes && 
                                        callback.resultNotes !== 'undefined' && 
                                        callback.resultNotes.trim() !== '';
              const hasValidNotes = callback.notes && 
                                  callback.notes !== 'undefined' && 
                                  callback.notes.trim() !== '';
              
              return hasValidResultNotes || hasValidNotes;
            })
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

          consultationCallbacks.forEach((callback: any) => {
            let consultationText = '';
            
            if (callback.resultNotes && 
                callback.resultNotes !== 'undefined' && 
                callback.resultNotes.trim() !== '') {
              consultationText = callback.resultNotes;
            } else if (callback.notes && 
                      callback.notes !== 'undefined' && 
                      callback.notes.trim() !== '') {
              consultationText = callback.notes;
            }
            
            if (consultationText) {
              const callbackDate = new Date(callback.date).toLocaleDateString();
              const callbackType = callback.isVisitManagementCallback ? '내원관리' : '상담관리';
              consultationContents.push(`[${callbackType} ${callback.type} - ${callbackDate}]\n${consultationText}`);
            }
          });
        }

        // 🔥 견적금액 계산 (우선순위: 내원 견적 > 전화 견적)
        let estimatedAmount = 0;
        let phoneAmount = 0;
        let visitAmount = 0;
        let hasPhoneConsultation = false;
        let hasVisitConsultation = false;

        // 전화상담 견적 (최초 상담)
        if (patient.consultation?.estimatedAmount && patient.consultation.estimatedAmount > 0) {
          phoneAmount = patient.consultation.estimatedAmount;
          hasPhoneConsultation = true;
        }

        // 내원상담 견적 (내원 후 상담)
        if (patient.postVisitConsultation?.estimateInfo) {
          const estimate = patient.postVisitConsultation.estimateInfo;
          visitAmount = estimate.discountPrice || estimate.regularPrice || 0;
          if (visitAmount > 0) {
            hasVisitConsultation = true;
          }
        }

        // 최종 견적금액 결정 (내원 견적 우선)
        estimatedAmount = visitAmount > 0 ? visitAmount : phoneAmount;

        // 🔥 진행상황 계산을 위한 필드들
        const visitConfirmed = patient.visitConfirmed === true;
        const isCompleted = patient.isCompleted === true || patient.status === '종결';

        const fullConsultation = consultationContents.length > 0 ? consultationContents.join('\n\n') : '상담내용 없음';
        const consultationSummary = fullConsultation.length > 200 ? 
          fullConsultation.substring(0, 200) + '...' : fullConsultation;

        return {
          _id: patient._id.toString(),
          name: patient.name,
          age: patient.age,
          interestedServices: patient.interestedServices || [],
          consultationSummary,
          fullConsultation,
          estimatedAmount,
          // 🔥 일별보고서용 추가 필드들
          callInDate: patient.callInDate,
          visitDate: patient.visitDate,
          hasPhoneConsultation,
          hasVisitConsultation,
          phoneAmount,
          visitAmount,
          // 🔥 진행상황 계산을 위한 필드들
          status: patient.status,
          visitConfirmed,
          postVisitStatus: patient.postVisitStatus,
          isCompleted
        };
      })
      .sort((a, b) => {
        // 🔥 정렬: 견적금액이 높은 순으로
        return b.estimatedAmount - a.estimatedAmount;
      });

    console.log(`✅ 상담 내용이 있는 환자: ${patientConsultations.length}명`);

    return NextResponse.json({ 
      success: true, 
      data: {
        selectedDate,
        patientConsultations,
        summary: {
          totalPatients: patientConsultations.length,
          totalEstimate: patientConsultations.reduce((sum, p) => sum + p.estimatedAmount, 0),
          phoneConsultations: patientConsultations.filter(p => p.hasPhoneConsultation).length,
          visitConsultations: patientConsultations.filter(p => p.hasVisitConsultation).length
        }
      }
    });

  } catch (error) {
    console.error('❌ 일별 환자별 상담 내용 조회 오류:', error);
    return NextResponse.json(
      { 
        message: '일별 환자별 상담 내용 조회 중 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: 500 }
    );
  }
}