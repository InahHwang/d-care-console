// 6단계 진행상황 계산 유틸리티 함수
export type PatientProgressStage = 
  | '전화상담' 
  | '예약완료' 
  | '내원완료' 
  | '치료동의' 
  | '치료시작' 
  | '종결';

export interface PatientProgressInfo {
  stage: PatientProgressStage;
  color: string;
  bgColor: string;
}

/**
 * 환자의 내원여부와 상태를 기반으로 6단계 진행상황을 계산합니다
 * 
 * 로직:
 * 1. 전화상담: 미내원 + (콜백필요 OR 잠재고객 OR 미처리콜백)
 * 2. 예약완료: 미내원 + status === '예약확정'  
 * 3. 내원완료: 내원완료 + (재콜백 OR 상태미설정)
 * 4. 치료동의: 내원완료 + 치료동의
 * 5. 치료시작: 내원완료 + 치료시작
 * 6. 종결: 종결상태 (내원여부 무관)
 */
export function calculatePatientProgress(patient: {
  visitConfirmed?: boolean;
  status?: string;
  postVisitStatus?: string;
  isCompleted?: boolean;
}): PatientProgressInfo {
  // 6. 종결 (최우선 - 내원여부 무관)
  if (patient.isCompleted === true || patient.status === '종결') {
    return {
      stage: '종결',
      color: 'text-gray-600',
      bgColor: 'bg-gray-100'
    };
  }

  // 내원완료 여부로 크게 분기
  if (patient.visitConfirmed === true) {
    // 내원완료 환자들
    switch (patient.postVisitStatus) {
      case '치료시작':
        // 5. 치료시작
        return {
          stage: '치료시작',
          color: 'text-green-800',
          bgColor: 'bg-green-100'
        };
      
      case '치료동의':
        // 4. 치료동의
        return {
          stage: '치료동의',
          color: 'text-blue-800',
          bgColor: 'bg-blue-100'
        };
      
      case '재콜백':
      case '':
      case null:
      case undefined:
        // 3. 내원완료 (재콜백 OR 상태미설정)
        return {
          stage: '내원완료',
          color: 'text-purple-800',
          bgColor: 'bg-purple-100'
        };
      
      default:
        // 기타 내원 후 상태들도 내원완료로 분류
        return {
          stage: '내원완료',
          color: 'text-purple-800',
          bgColor: 'bg-purple-100'
        };
    }
  } else {
    // 미내원 환자들
    if (patient.status === '예약확정') {
      // 2. 예약완료
      return {
        stage: '예약완료',
        color: 'text-orange-800',
        bgColor: 'bg-orange-100'
      };
    } else {
      // 1. 전화상담 (콜백필요, 잠재고객, 미처리콜백 등 모든 미내원 상태)
      return {
        stage: '전화상담',
        color: 'text-yellow-800',
        bgColor: 'bg-yellow-100'
      };
    }
  }
}

/**
 * 진행상황별 우선순위 정렬을 위한 순서값 반환
 */
export function getProgressSortOrder(stage: PatientProgressStage): number {
  const order: Record<PatientProgressStage, number> = {
    '전화상담': 1,
    '예약완료': 2,
    '내원완료': 3,
    '치료동의': 4,
    '치료시작': 5,
    '종결': 6
  };
  return order[stage];
}

/**
 * 진행상황별 통계 계산
 */
export function calculateProgressStats(patients: any[]): Record<PatientProgressStage, number> {
  const stats: Record<PatientProgressStage, number> = {
    '전화상담': 0,
    '예약완료': 0,
    '내원완료': 0,
    '치료동의': 0,
    '치료시작': 0,
    '종결': 0
  };

  patients.forEach(patient => {
    const progress = calculatePatientProgress(patient);
    stats[progress.stage]++;
  });

  return stats;
}