// src/app/api/v2/reports/daily/[date]/route.ts
// v2 일별 마감 리포트 API

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import type { ConsultationV2, PatientV2, CallLogV2 } from '@/types/v2';

interface DailyReportPatient {
  id: string;
  patientId: string;  // 환자 상세 페이지 링크용
  name: string;
  phone: string;
  status: 'agreed' | 'disagreed' | 'pending' | 'no_answer' | 'no_consultation' | 'closed';
  type: 'phone' | 'visit';  // 상담 유형
  treatment: string;
  originalAmount: number;
  discountRate: number;
  discountAmount: number;
  finalAmount: number;
  discountReason?: string;
  disagreeReasons: string[];
  correctionPlan?: string;
  appointmentDate?: string;
  callbackDate?: string;
  consultantName: string;
  time: string;  // 통화 시작 시간
  duration?: number;  // 통화 시간 (초)
  aiSummary?: string;
  // 환자 추가 정보
  gender?: '남' | '여';
  age?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  region?: any;
  memo?: string;
  inquiry?: string;
  // 상담 회차 정보
  consultationNumber?: number;  // 1차, 2차, 3차...
  // 해당 날짜의 모든 상담 기록 (시간순)
  consultations?: { type: 'phone' | 'visit' | 'other'; time: string; content?: string; consultantName?: string; duration?: number }[];
}

interface DailyReportSummary {
  total: number;
  agreed: number;
  disagreed: number;
  pending: number;
  noAnswer: number;
  noConsultation: number;
  closed: number;
  expectedRevenue: number;
  actualRevenue: number;
  totalDiscount: number;
  avgDiscountRate: number;
  callbackCount: number;
  newPatients: number;
  existingPatients: number;
  // 상담 유형별 통계
  phoneConsultations: number;
  visitConsultations: number;
}

// 기존 환자 통화 기록 (치료중/치료완료/종결 등 - 성과 지표 제외)
interface ExistingPatientCall {
  id: string;
  patientId: string;
  name: string;
  phone: string;
  patientStatus: string;
  treatment?: string;
  time: string;
  duration?: number;
  aiSummary?: string;
  gender?: '남' | '여';
  age?: number;
  memo?: string;
}

interface ExistingPatientCallSummary {
  total: number;
  byStatus: Record<string, number>;
}

// 기존 환자로 분류되는 상태 목록
// 이 상태의 환자는 이미 치료가 시작되었거나 완료된 상태이므로
// "동의/미동의/보류" 분류가 부적절함
const EXISTING_PATIENT_STATUSES = [
  'treatment',        // 치료중
  'treatmentBooked',  // 치료예약
  'completed',        // 치료완료
  'followup',         // 사후관리
  'closed',           // 종결
];

// 환자의 실제 상태를 가져오는 함수
// V2에서는 여정(journey) 기반으로 상태를 관리하므로
// 활성 여정의 status를 우선 확인하고, 없으면 환자 레벨 status 사용
function getEffectivePatientStatus(patient: PatientV2): string {
  // 활성 여정이 있으면 그 status 사용
  if (patient.journeys && patient.activeJourneyId) {
    const activeJourney = patient.journeys.find(j => j.id === patient.activeJourneyId);
    if (activeJourney) {
      return activeJourney.status;
    }
  }
  // 여정이 없으면 환자 레벨 status 사용
  return patient.status;
}

// 환자가 해당 날짜에 신규 등록되었는지 판단
// createdAt이 해당 날짜와 같은 날이면 신환 (status 무관)
function isNewPatientOnDate(patient: PatientV2, dateStr: string): boolean {
  const patientCreated = new Date(patient.createdAt);
  // KST 기준으로 비교 (UTC+9)
  const kstOffset = 9 * 60 * 60 * 1000;
  const createdKST = new Date(patientCreated.getTime() + kstOffset);
  const reportDate = new Date(dateStr + 'T00:00:00.000Z');
  return createdKST.getUTCFullYear() === reportDate.getUTCFullYear()
    && createdKST.getUTCMonth() === reportDate.getUTCMonth()
    && createdKST.getUTCDate() === reportDate.getUTCDate();
}

export async function GET(
  request: NextRequest,
  { params }: { params: { date: string } }
) {
  try {
    const selectedDate = params.date;

    // 날짜 형식 검증
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 날짜 형식입니다. (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    console.log(`[Report v2] ${selectedDate} 일별 리포트 조회`);

    const { db } = await connectToDatabase();

    // 해당 날짜의 상담 기록 조회
    const startOfDay = `${selectedDate}T00:00:00.000Z`;
    const endOfDay = `${selectedDate}T23:59:59.999Z`;

    const consultations = await db.collection<ConsultationV2>('consultations_v2').find({
      date: {
        $gte: new Date(startOfDay),
        $lte: new Date(endOfDay),
      },
    }).toArray();

    // 해당 날짜 통화 기록 조회 (상담 기록이 없는 경우 통화 기반으로)
    // createdAt이 Date 객체이므로 Date로 변환하여 비교
    const callLogs = await db.collection<CallLogV2>('callLogs_v2').find({
      createdAt: {
        $gte: new Date(startOfDay),
        $lte: new Date(endOfDay),
      },
      aiStatus: 'completed',
    }).toArray();

    // 해당 날짜의 수동 상담 기록 조회
    const manualConsultations = await db.collection('manualConsultations_v2').find({
      date: {
        $gte: new Date(startOfDay),
        $lte: new Date(endOfDay),
      },
    }).toArray();

    // 환자 ID 수집
    const patientIds = new Set<string>();
    consultations.forEach((c) => patientIds.add(c.patientId));
    callLogs.forEach((c) => {
      if (c.patientId) patientIds.add(c.patientId);
    });
    manualConsultations.forEach((c) => {
      if (c.patientId) patientIds.add(c.patientId);
    });

    // 환자 정보 조회
    const patients = await db.collection<PatientV2>('patients_v2').find({
      _id: { $in: Array.from(patientIds).map((id) => new (require('mongodb').ObjectId)(id)) },
    }).toArray();

    const patientMap = new Map(patients.map((p) => [p._id?.toString(), p]));

    // 상담 회차 계산: 각 환자별 "오늘 이전" 상담 수 조회
    const consultationPatientIdList = Array.from(new Set(consultations.map((c) => c.patientId)));
    const previousConsultationCounts = consultationPatientIdList.length > 0
      ? await db.collection('consultations_v2')
          .aggregate([
            {
              $match: {
                patientId: { $in: consultationPatientIdList },
                date: { $lt: new Date(startOfDay) },
              },
            },
            {
              $group: {
                _id: '$patientId',
                count: { $sum: 1 },
              },
            },
          ])
          .toArray()
      : [];
    const prevCountMap = new Map(
      previousConsultationCounts.map((p) => [p._id as string, p.count as number])
    );

    // callLogs를 patientId로 매핑 (duration 조회용)
    const callLogByPatientMap = new Map(
      callLogs.map((c) => [c.patientId, c])
    );
    // callLogs를 _id로도 매핑 (callLogId로 직접 찾기 위함)
    const callLogByIdMap = new Map(
      callLogs.map((c) => [c._id?.toString(), c])
    );

    // 상담 기록 기반 리포트 데이터 생성
    // 환자 status에 따라 신환 상담 / 기존 환자 통화로 분리
    // ★ patientId 기준 그룹핑: 같은 환자가 여러 상담이어도 한 번만 표시
    const reportPatientsMap = new Map<string, DailyReportPatient>();
    const existingPatientCalls: ExistingPatientCall[] = [];

    // 헬퍼: 신환 환자의 consultations 배열에 상담 기록 추가
    const addConsultationEntry = (patientId: string, entry: { type: 'phone' | 'visit' | 'other'; time: string; content?: string; consultantName?: string; duration?: number }) => {
      const existing = reportPatientsMap.get(patientId);
      if (existing) {
        if (!existing.consultations) existing.consultations = [];
        existing.consultations.push(entry);
      }
    };

    consultations.forEach((consultation) => {
      const patient = patientMap.get(consultation.patientId);
      const callLog = consultation.callLogId
        ? callLogByIdMap.get(consultation.callLogId)
        : callLogByPatientMap.get(consultation.patientId);

      const time = new Date(consultation.createdAt).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Seoul',
      });

      const isNewPatient = patient ? isNewPatientOnDate(patient, selectedDate) : true;
      const consultationContent = consultation.aiSummary || callLog?.aiAnalysis?.summary;

      if (!isNewPatient) {
        existingPatientCalls.push({
          id: consultation._id?.toString() || '',
          patientId: consultation.patientId,
          name: patient!.name,
          phone: patient!.phone,
          patientStatus: getEffectivePatientStatus(patient!),
          treatment: consultation.treatment || patient!.interest || '미정',
          time,
          duration: callLog?.duration,
          aiSummary: consultationContent,
          gender: patient!.gender,
          age: patient!.age,
          memo: consultation.memo || patient!.memo,
        });
      } else {
        // ★ 이미 같은 환자가 있으면 consultations 배열에만 추가
        if (reportPatientsMap.has(consultation.patientId)) {
          addConsultationEntry(consultation.patientId, {
            type: consultation.type || 'phone',
            time,
            content: consultationContent,
            consultantName: consultation.consultantName,
            duration: callLog?.duration,
          });
        } else {
          const entry: DailyReportPatient = {
            id: consultation._id?.toString() || '',
            patientId: consultation.patientId,
            name: patient?.name || '미확인',
            phone: patient?.phone || '',
            status: consultation.status,
            type: consultation.type || 'phone',
            treatment: consultation.treatment,
            originalAmount: Math.round(consultation.originalAmount / 10000),
            discountRate: consultation.discountRate,
            discountAmount: Math.round(consultation.discountAmount / 10000),
            finalAmount: Math.round(consultation.finalAmount / 10000),
            discountReason: consultation.discountReason,
            disagreeReasons: consultation.disagreeReasons || [],
            correctionPlan: consultation.correctionPlan,
            appointmentDate: consultation.appointmentDate
              ? new Date(consultation.appointmentDate).toISOString().split('T')[0]
              : undefined,
            callbackDate: consultation.callbackDate
              ? new Date(consultation.callbackDate).toISOString().split('T')[0]
              : undefined,
            consultantName: consultation.consultantName,
            time,
            duration: callLog?.duration,
            aiSummary: consultationContent,
            gender: patient?.gender,
            age: patient?.age,
            region: patient?.region,
            memo: consultation.memo,
            inquiry: consultation.inquiry,
            consultationNumber: (prevCountMap.get(consultation.patientId) || 0) + 1,
            consultations: [{
              type: consultation.type || 'phone',
              time,
              content: consultationContent,
              consultantName: consultation.consultantName,
              duration: callLog?.duration,
            }],
          };
          reportPatientsMap.set(consultation.patientId, entry);
        }
      }
    });

    // ★ consultation에 이미 연결된 callLogId Set (중복 방지)
    const processedCallLogIds = new Set(
      consultations.filter((c) => c.callLogId).map((c) => c.callLogId)
    );

    callLogs.forEach((call) => {
      if (!call.patientId) return;
      const callId = call._id?.toString();
      // ★ consultation에 이미 연결된 callLog는 건너뛰기 (이미 consultations 배열에 포함됨)
      if (callId && processedCallLogIds.has(callId)) return;

      const patient = patientMap.get(call.patientId);
      if (patient) {
        const callTime = new Date(call.createdAt).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Seoul',
        });

        if (!isNewPatientOnDate(patient, selectedDate)) {
          existingPatientCalls.push({
            id: call._id?.toString() || '',
            patientId: call.patientId,
            name: patient.name,
            phone: patient.phone,
            patientStatus: getEffectivePatientStatus(patient),
            treatment: patient.interest || '미정',
            time: callTime,
            duration: call.duration,
            aiSummary: call.aiAnalysis?.summary,
            gender: patient.gender,
            age: patient.age,
            memo: patient.memo,
          });
        } else if (reportPatientsMap.has(call.patientId)) {
          // ★ 이미 같은 환자가 있으면 consultations에 추가 (두 번째 통화 등)
          if (call.aiAnalysis?.summary) {
            addConsultationEntry(call.patientId, {
              type: 'phone',
              time: callTime,
              content: call.aiAnalysis?.summary,
              consultantName: reportPatientsMap.get(call.patientId)?.consultantName,
              duration: call.duration,
            });
          }
        } else {
          const getConsultantName = () => {
            if (patient.statusHistory?.[0]?.changedBy && patient.statusHistory[0].changedBy !== '시스템') {
              return patient.statusHistory[0].changedBy;
            }
            if (patient.aiRegistered) return '자동등록';
            return '미확인';
          };
          // 환자의 nextActionDate (콜백 예정일) 가져오기
          const patientCallbackDate = (() => {
            if (patient.journeys && patient.activeJourneyId) {
              const activeJourney = patient.journeys.find(j => j.id === patient.activeJourneyId);
              if (activeJourney?.nextActionDate) {
                return new Date(activeJourney.nextActionDate).toISOString().split('T')[0];
              }
            }
            if (patient.nextActionDate) {
              return new Date(patient.nextActionDate).toISOString().split('T')[0];
            }
            return undefined;
          })();

          reportPatientsMap.set(call.patientId, {
            id: call._id?.toString() || '',
            patientId: call.patientId,
            name: patient.name,
            phone: patient.phone,
            status: call.status === 'missed' ? 'no_answer' : 'no_consultation',
            type: 'phone',
            treatment: patient.interest || '미정',
            originalAmount: 0,
            discountRate: 0,
            discountAmount: 0,
            finalAmount: 0,
            disagreeReasons: [],
            callbackDate: patientCallbackDate,
            consultantName: getConsultantName(),
            time: callTime,
            duration: call.duration,
            aiSummary: call.aiAnalysis?.summary,
            gender: patient.gender,
            age: patient.age,
            region: patient.region,
            memo: patient.memo,
            consultations: call.aiAnalysis?.summary ? [{
              type: 'phone' as const,
              time: callTime,
              content: call.aiAnalysis?.summary,
              consultantName: getConsultantName(),
              duration: call.duration,
            }] : undefined,
          });
        }
      }
    });

    // ★ 수동 상담 처리: 이미 있는 환자면 consultations에 추가 (제외하지 않음)
    manualConsultations.forEach((manual) => {
      const patient = patientMap.get(manual.patientId);
      const time = new Date(manual.date).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Seoul',
      });

      const isNewPatient = patient ? isNewPatientOnDate(patient, selectedDate) : true;

      if (!isNewPatient) {
        existingPatientCalls.push({
          id: manual._id?.toString() || '',
          patientId: manual.patientId,
          name: patient!.name,
          phone: patient!.phone,
          patientStatus: getEffectivePatientStatus(patient!),
          treatment: patient!.interest || '미정',
          time,
          duration: undefined,
          aiSummary: manual.content,
          gender: patient!.gender,
          age: patient!.age,
          memo: patient!.memo,
        });
      } else if (reportPatientsMap.has(manual.patientId)) {
        // ★ 이미 있는 신환 → consultations에 수동 상담 추가
        addConsultationEntry(manual.patientId, {
          type: manual.type === 'visit' ? 'visit' : manual.type === 'other' ? 'other' : 'phone',
          time,
          content: manual.content,
          consultantName: manual.consultantName,
        });
      } else {
        // 수동 상담만 있는 신환
        reportPatientsMap.set(manual.patientId, {
          id: manual._id?.toString() || '',
          patientId: manual.patientId,
          name: patient?.name || '미확인',
          phone: patient?.phone || '',
          status: 'no_consultation',
          type: manual.type === 'visit' ? 'visit' : 'phone',
          treatment: patient?.interest || '미정',
          originalAmount: 0,
          discountRate: 0,
          discountAmount: 0,
          finalAmount: 0,
          disagreeReasons: [],
          consultantName: manual.consultantName || '미지정',
          time,
          duration: undefined,
          aiSummary: manual.content,
          gender: patient?.gender,
          age: patient?.age,
          region: patient?.region,
          memo: patient?.memo,
          consultations: [{
            type: manual.type === 'visit' ? 'visit' : manual.type === 'other' ? 'other' : 'phone',
            time,
            content: manual.content,
            consultantName: manual.consultantName,
          }],
        });
      }
    });

    // ★ 신환 환자의 전체 상담 타임라인 구축 (첫 통화 ~ 오늘)
    const newPatientIds = Array.from(reportPatientsMap.keys());
    if (newPatientIds.length > 0) {
      // 신환 환자의 전체 callLog 조회 (날짜 제한 없이, AI 요약 있는 것만)
      const allCallLogs = await db.collection('callLogs_v2').find({
        patientId: { $in: newPatientIds },
        'aiAnalysis.summary': { $exists: true, $ne: '' },
      }).sort({ createdAt: 1 }).toArray();

      // 신환 환자의 전체 수동 상담 조회 (날짜 제한 없이)
      const allManualConsults = await db.collection('manualConsultations_v2').find({
        patientId: { $in: newPatientIds },
      }).sort({ date: 1 }).toArray();

      // 신환 환자의 전체 consultation 조회 (callLogId → consultantName 매핑용)
      const allConsultations = await db.collection('consultations_v2').find({
        patientId: { $in: newPatientIds },
      }).toArray();
      // callLogId → consultantName 매핑
      const callLogConsultantMap = new Map<string, string>();
      allConsultations.forEach((c: any) => {
        if (c.callLogId && c.consultantName) {
          callLogConsultantMap.set(c.callLogId.toString(), c.consultantName);
        }
      });

      // 환자별 타임라인 재구축
      reportPatientsMap.forEach((patient, patientId) => {
        const timeline: { type: 'phone' | 'visit' | 'other'; time: string; content?: string; consultantName?: string; duration?: number }[] = [];
        const seenContents = new Set<string>(); // 중복 내용 방지

        // callLog 기반 상담
        const patientCalls = allCallLogs.filter((c: any) => c.patientId === patientId);
        for (const call of patientCalls) {
          const content = call.aiAnalysis?.summary;
          if (!content) continue;
          const contentKey = content.substring(0, 100); // 내용 앞부분으로 중복 체크
          if (seenContents.has(contentKey)) continue;
          seenContents.add(contentKey);

          const callDate = new Date(call.createdAt);
          const callDateKST = callDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
          const isToday = callDateKST === selectedDate;
          const timeStr = isToday
            ? callDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' })
            : `${parseInt(callDateKST.split('-')[1])}/${parseInt(callDateKST.split('-')[2])} ${callDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' })}`;

          const callId = call._id?.toString() || '';
          const consultant = callLogConsultantMap.get(callId) || patient.consultantName;
          timeline.push({
            type: 'phone',
            time: timeStr,
            content,
            consultantName: consultant !== '미확인' ? consultant : undefined,
            duration: call.duration,
          });
        }

        // 수동 상담
        const patientManuals = allManualConsults.filter((m: any) => m.patientId === patientId);
        for (const manual of patientManuals) {
          const content = manual.content;
          if (!content) continue;
          const contentKey = content.substring(0, 100);
          if (seenContents.has(contentKey)) continue;
          seenContents.add(contentKey);

          const manualDate = new Date(manual.date);
          const manualDateKST = manualDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
          const isToday = manualDateKST === selectedDate;
          const timeStr = isToday
            ? manualDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' })
            : `${parseInt(manualDateKST.split('-')[1])}/${parseInt(manualDateKST.split('-')[2])} ${manualDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' })}`;

          timeline.push({
            type: manual.type === 'visit' ? 'visit' : manual.type === 'other' ? 'other' : 'phone',
            time: timeStr,
            content,
            consultantName: manual.consultantName,
          });
        }

        // 시간순 정렬
        timeline.sort((a, b) => {
          // 날짜 포함된 것(과거)이 먼저, 같은 날짜면 시간순
          const aHasDate = a.time.includes('/');
          const bHasDate = b.time.includes('/');
          if (aHasDate && !bHasDate) return -1;
          if (!aHasDate && bHasDate) return 1;
          return a.time.localeCompare(b.time);
        });

        if (timeline.length > 0) {
          patient.consultations = timeline;
        }
      });
    }

    // ★ Map → 배열 변환
    const reportPatients = Array.from(reportPatientsMap.values());

    // 4번째 소스: 해당 날짜에 등록된 신환 중 상담/통화 기록이 없는 환자
    // (환자 등록만 하고 상담 입력을 안 한 경우에도 신환으로 일보에 표시)
    const allProcessedPatientIds = new Set([
      ...consultations.map((c) => c.patientId),
      ...callLogs.filter((c) => c.patientId).map((c) => c.patientId!),
      ...manualConsultations.filter((c) => c.patientId).map((c) => c.patientId as string),
    ]);

    const { ObjectId } = require('mongodb');
    const newPatientsToday = await db.collection<PatientV2>('patients_v2').find({
      createdAt: {
        $gte: new Date(startOfDay),
        $lte: new Date(endOfDay),
      },
    }).toArray();

    newPatientsToday.forEach((patient) => {
      const pid = patient._id?.toString();
      if (!pid || allProcessedPatientIds.has(pid)) return;

      // 담당 상담사 결정
      const getConsultantName = () => {
        if (patient.statusHistory?.[0]?.changedBy && patient.statusHistory[0].changedBy !== '시스템') {
          return patient.statusHistory[0].changedBy;
        }
        if (patient.aiRegistered) return '자동등록';
        return '미확인';
      };

      const time = new Date(patient.createdAt).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Seoul',
      });

      reportPatients.push({
        id: pid,
        patientId: pid,
        name: patient.name,
        phone: patient.phone,
        status: 'no_consultation',
        type: 'phone',
        treatment: patient.interest || '미정',
        originalAmount: 0,
        discountRate: 0,
        discountAmount: 0,
        finalAmount: 0,
        disagreeReasons: [],
        consultantName: getConsultantName(),
        time,
        duration: undefined,
        aiSummary: undefined,
        gender: patient.gender,
        age: patient.age,
        region: patient.region,
        memo: patient.memo,
      });
    });

    // ★ 후처리: 치료 시작 환자 자동 동의 + 금액 반영
    // 오늘 신규 등록 후 바로 치료 시작한 환자는 자동 '동의' 처리
    const TREATMENT_STATUSES = ['treatment', 'treatmentBooked', 'completed', 'followup'];
    reportPatients.forEach((rp) => {
      const patient = patientMap.get(rp.patientId);
      if (!patient) return;

      const effectiveStatus = getEffectivePatientStatus(patient);

      // 1) 치료중/치료완료 상태인데 상담 결과가 미입력이면 → 자동 동의
      if (TREATMENT_STATUSES.includes(effectiveStatus) && rp.status === 'no_consultation') {
        rp.status = 'agreed';
      }

      // 2) callbackDate가 없으면 환자의 nextActionDate를 fallback으로 사용
      if (!rp.callbackDate) {
        const activeJourneyForCb = patient.journeys?.find(j => j.id === patient.activeJourneyId);
        const nextDate = activeJourneyForCb?.nextActionDate || patient.nextActionDate;
        if (nextDate) {
          rp.callbackDate = new Date(nextDate).toISOString().split('T')[0];
        }
      }

      // 3) 금액이 0인데 환자에 estimatedAmount가 있으면 반영
      if (rp.originalAmount === 0 && (patient.estimatedAmount || patient.actualAmount)) {
        const activeJourney = patient.journeys?.find(j => j.id === patient.activeJourneyId);
        const estimated = activeJourney?.estimatedAmount || patient.estimatedAmount || 0;
        const actual = activeJourney?.actualAmount || patient.actualAmount || 0;
        rp.originalAmount = Math.round(estimated / 10000);
        rp.finalAmount = actual > 0 ? Math.round(actual / 10000) : rp.originalAmount;
        if (rp.originalAmount > 0 && rp.finalAmount < rp.originalAmount) {
          rp.discountAmount = rp.originalAmount - rp.finalAmount;
          rp.discountRate = Math.round((rp.discountAmount / rp.originalAmount) * 100);
        }
      }
    });

    // 통계 계산
    const agreed = reportPatients.filter((p) => p.status === 'agreed');
    const disagreed = reportPatients.filter((p) => p.status === 'disagreed');
    const pending = reportPatients.filter((p) => p.status === 'pending');
    const noAnswer = reportPatients.filter((p) => p.status === 'no_answer');
    const noConsultation = reportPatients.filter((p) => p.status === 'no_consultation');
    const closed = reportPatients.filter((p) => p.status === 'closed');

    const expectedRevenue = reportPatients.reduce((sum, p) => sum + p.originalAmount, 0);
    const actualRevenue = agreed.reduce((sum, p) => sum + p.finalAmount, 0);
    const totalDiscount = reportPatients.reduce((sum, p) => sum + p.discountAmount, 0);

    // 신규/기존 환자 통계 (통화 기록 기반)
    // 신환, 구신환을 신규로 카운트
    const newPatientCount = callLogs.filter(
      (c) => c.aiAnalysis?.classification === '신환' || c.aiAnalysis?.classification === '구신환'
    ).length;

    // 상담 유형별 통계
    const phoneConsultations = reportPatients.filter((p) => p.type === 'phone').length;
    const visitConsultations = reportPatients.filter((p) => p.type === 'visit').length;

    const summary: DailyReportSummary = {
      total: reportPatients.length,
      agreed: agreed.length,
      disagreed: disagreed.length,
      pending: pending.length,
      noAnswer: noAnswer.length,
      noConsultation: noConsultation.length,
      closed: closed.length,
      expectedRevenue,
      actualRevenue,
      totalDiscount,
      avgDiscountRate: expectedRevenue > 0
        ? Math.round((totalDiscount / expectedRevenue) * 100)
        : 0,
      callbackCount: reportPatients.filter((p) => p.callbackDate).length,
      newPatients: newPatientCount,
      existingPatients: callLogs.length - newPatientCount,
      phoneConsultations,
      visitConsultations,
    };

    // 요일 계산
    const dateObj = new Date(selectedDate);
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];

    // 기존 환자 통화 요약 계산
    const existingPatientCallSummary: ExistingPatientCallSummary = {
      total: existingPatientCalls.length,
      byStatus: existingPatientCalls.reduce((acc, call) => {
        acc[call.patientStatus] = (acc[call.patientStatus] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return NextResponse.json({
      success: true,
      data: {
        date: selectedDate,
        dayOfWeek,
        summary,
        patients: reportPatients,
        // 기존 환자 통화 (치료중/치료완료/종결 - 성과 지표 제외)
        existingPatientCalls,
        existingPatientCallSummary,
      },
    });
  } catch (error) {
    console.error('[Report v2] daily 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
