'use client';

import React, { useState, useEffect } from 'react';
import { useAppSelector } from '@/hooks/reduxHooks';
import { 
  Calendar, 
  Users, 
  RefreshCw,
  Eye,
  AlertCircle,
  FileText,
  DollarSign,
  Phone
} from 'lucide-react';
import { Patient } from '@/types/patient';

// 일별 환자 데이터 타입 (내원관리용)
interface DailyPatientData {
  _id: string;
  name: string;
  treatmentContent: string;
  estimatedAmount: number;
  postVisitStatus: string;
  consultationContent: string;
  visitDate: string;
}

// 일별 상담관리 환자 데이터 타입
interface DailyConsultationData {
  _id: string;
  name: string;
  treatmentContent: string;
  estimatedAmount: number;
  status: string;
  callbackCount: number;
  consultationContent: string;
  callInDate: string;
}

const DailyReport: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyPatients, setDailyPatients] = useState<DailyPatientData[]>([]);
  const [dailyConsultations, setDailyConsultations] = useState<DailyConsultationData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Redux에서 환자 데이터 가져오기
  const { patients } = useAppSelector((state) => state.patients);

  // 상태별 색상 매핑 (내원관리용)
  const getStatusColor = (status: string) => {
    switch (status) {
      case '치료시작':
        return 'bg-green-100 text-green-800';
      case '치료동의':
        return 'bg-blue-100 text-blue-800';
      case '재콜백필요':
        return 'bg-yellow-100 text-yellow-800';
      case '종결':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-red-100 text-red-800'; // 상태미설정
    }
  };

  // 상담관리 환자 상태 매핑
  const mapConsultationStatus = (patient: Patient): string => {
    const today = new Date().toISOString().split('T')[0];
    
    // 오늘 예약인지 확인
    if (patient.reservationDate === today) {
      return '오늘예약';
    }
    
    // 기존 상태를 6가지로 매핑
    switch (patient.status) {
      case '예약확정':
        return '내원확정';
      case '콜백필요':
        return '콜백필요';
      case '부재중':
        return '부재중';
      default:
        // 예약 후 미내원 체크
        if (patient.isPostReservationPatient || patient.hasBeenPostReservationPatient) {
          return '예약후미내원';
        }
        // 미처리 콜백이 있는지 체크
        const hasPendingCallback = patient.callbackHistory?.some(
          callback => callback.status === '예정' || callback.status === '부재중'
        );
        if (hasPendingCallback) {
          return '미처리콜백';
        }
        return '콜백필요'; // 기본값
    }
  };

  // 상담관리 환자 상태별 색상
  const getConsultationStatusColor = (status: string) => {
    switch (status) {
      case '내원확정':
        return 'bg-green-100 text-green-800';
      case '오늘예약':
        return 'bg-purple-100 text-purple-800';
      case '콜백필요':
        return 'bg-yellow-100 text-yellow-800';
      case '부재중':
        return 'bg-gray-100 text-gray-800';
      case '예약후미내원':
        return 'bg-orange-100 text-orange-800';
      case '미처리콜백':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // 금액 포맷팅
  const formatAmount = (amount: number) => {
    if (amount >= 100000000) {
      return `${(amount / 100000000).toFixed(1)}억원`;
    }
    if (amount >= 10000) {
      return `${(amount / 10000).toFixed(0)}만원`;
    }
    return `${amount.toLocaleString()}원`;
  };

  // 내원관리 환자 상담내용 조합 함수
  const getCombinedConsultationContent = (patient: Patient): string => {
    const contents: string[] = [];
    
    // 최초 상담내용
    if (patient.postVisitConsultation?.firstVisitConsultationContent) {
      contents.push(`[최초 상담] ${patient.postVisitConsultation.firstVisitConsultationContent}`);
    }

    // 콜백 히스토리에서 내원관리 콜백들 추출
    if (patient.callbackHistory) {
      const visitCallbacks = patient.callbackHistory
        .filter(callback => callback.isVisitManagementCallback && callback.resultNotes)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      visitCallbacks.forEach((callback, index) => {
        if (callback.resultNotes) {
          contents.push(`[${callback.type}] ${callback.resultNotes}`);
        }
      });
    }

    return contents.length > 0 ? contents.join('\n\n') : '-';
  };

  // 상담관리 환자의 상담내용 조합 함수
  const getConsultationContent = (patient: Patient): string => {
    const contents: string[] = [];
    
    // 최초 상담 - 불편한 부분과 상담메모 조합
    const consultation = patient.consultation;
    if (consultation) {
      let initialContent = '';
      if (consultation.treatmentPlan) {
        initialContent += `[불편한 부분] ${consultation.treatmentPlan}`;
      }
      if (consultation.consultationNotes) {
        if (initialContent) initialContent += '\n';
        initialContent += `[상담메모] ${consultation.consultationNotes}`;
      }
      if (initialContent) {
        contents.push(`[최초 상담]\n${initialContent}`);
      }
    }

    // 콜백 히스토리의 상담내용들
    if (patient.callbackHistory) {
      const consultationCallbacks = patient.callbackHistory
        .filter(callback => callback.resultNotes && callback.resultNotes.trim() !== '')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      consultationCallbacks.forEach((callback) => {
        if (callback.resultNotes) {
          contents.push(`[${callback.type} 콜백] ${callback.resultNotes}`);
        }
      });
    }

    return contents.length > 0 ? contents.join('\n\n') : '-';
  };

  // 선택된 날짜의 내원관리 환자 데이터 필터링
  const filterPatientsByDate = () => {
    if (!patients || patients.length === 0) {
      setDailyPatients([]);
      return;
    }

    const filtered = patients
      .filter(patient => {
        // visitDate가 선택된 날짜와 일치하는 환자만
        return patient.visitDate === selectedDate && patient.visitConfirmed;
      })
      .map(patient => ({
        _id: patient._id,
        name: patient.name,
        treatmentContent: patient.postVisitConsultation?.treatmentContent || '-',
        estimatedAmount: patient.postVisitConsultation?.estimateInfo?.discountPrice || 0,
        postVisitStatus: patient.postVisitStatus || '상태미설정',
        consultationContent: getCombinedConsultationContent(patient),
        visitDate: patient.visitDate || ''
      }));

    setDailyPatients(filtered);
  };

  // 선택된 날짜의 상담관리 환자 데이터 필터링
  const filterConsultationsByDate = () => {
    if (!patients || patients.length === 0) {
      console.log('❌ 환자 데이터가 없습니다. patients:', patients);
      setDailyConsultations([]);
      return;
    }

    console.log('=== 상담관리 환자 필터링 디버깅 ===');
    console.log('선택된 날짜:', selectedDate);
    console.log('전체 환자 수:', patients.length);
    
    // 6월 환자들만 먼저 확인
    const junePatients = patients.filter(patient => {
      const callInDate = patient.callInDate || '';
      return callInDate.startsWith('2025-06'); // 6월 환자들
    });
    console.log('6월 환자 수:', junePatients.length);
    
    // 6월 환자들의 callInDate 확인
    if (junePatients.length > 0) {
      console.log('6월 환자 이름과 callInDate:');
      junePatients.forEach((patient, index) => {
        console.log(`${index + 1}. ${patient.name}: ${patient.callInDate}`);
      });
    }
    
    // 날짜별 분포 확인
    const dateDistribution: Record<string, number> = {};
    junePatients.forEach(patient => {
      const date = patient.callInDate || 'unknown';
      dateDistribution[date] = (dateDistribution[date] || 0) + 1;
    });
    console.log('6월 날짜별 분포:', dateDistribution);
    
    // visitConfirmed 상태 분석
    const visitConfirmedCount = junePatients.filter(p => p.visitConfirmed).length;
    const notVisitConfirmedCount = junePatients.filter(p => !p.visitConfirmed).length;
    console.log('6월 환자 중 visitConfirmed: true =', visitConfirmedCount);
    console.log('6월 환자 중 visitConfirmed: false =', notVisitConfirmedCount);

    const filtered = patients
      .filter(patient => {
        const matchesDate = patient.callInDate === selectedDate;
        const notVisitConfirmed = !patient.visitConfirmed;
        
        // 필터링 조건 로그
        if (patient.callInDate === selectedDate) {
          console.log(`환자 ${patient.name}: 날짜 일치, visitConfirmed=${patient.visitConfirmed}, 포함 여부=${matchesDate && notVisitConfirmed}`);
        }
        
        return matchesDate && notVisitConfirmed;
      })
      .map(patient => ({
        _id: patient._id,
        name: patient.name,
        treatmentContent: patient.consultation?.treatmentPlan || '-',
        estimatedAmount: patient.consultation?.estimatedAmount || 0,
        status: mapConsultationStatus(patient),
        callbackCount: patient.callbackHistory?.length || 0,
        consultationContent: getConsultationContent(patient),
        callInDate: patient.callInDate || ''
      }));

    console.log('필터링 후 환자 수:', filtered.length);
    setDailyConsultations(filtered);
  };

  // 날짜 변경 시 또는 환자 데이터 변경 시 필터링
  useEffect(() => {
    setIsLoading(true);
    // 실제 환경에서는 API 호출 대신 기존 데이터 필터링
    setTimeout(() => {
      filterPatientsByDate();
      filterConsultationsByDate();
      setIsLoading(false);
    }, 300);
  }, [selectedDate, patients]);

  // 통계 계산
  const stats = {
    total: dailyPatients.length,
    treatmentStarted: dailyPatients.filter(p => p.postVisitStatus === '치료시작').length,
    treatmentConsented: dailyPatients.filter(p => p.postVisitStatus === '치료동의').length,
    callbackNeeded: dailyPatients.filter(p => p.postVisitStatus === '재콜백필요').length,
    terminated: dailyPatients.filter(p => p.postVisitStatus === '종결').length,
    unset: dailyPatients.filter(p => p.postVisitStatus === '상태미설정').length,
    totalAmount: dailyPatients.reduce((sum, p) => sum + p.estimatedAmount, 0)
  };

  // 상담관리 통계 계산
  const consultationStats = {
    total: dailyConsultations.length,
    unprocessedCallback: dailyConsultations.filter(p => p.status === '미처리콜백').length,
    postReservationAbsent: dailyConsultations.filter(p => p.status === '예약후미내원').length,
    visitConfirmed: dailyConsultations.filter(p => p.status === '내원확정').length,
    callbackNeeded: dailyConsultations.filter(p => p.status === '콜백필요').length,
    todayReservation: dailyConsultations.filter(p => p.status === '오늘예약').length,
    absent: dailyConsultations.filter(p => p.status === '부재중').length,
    totalAmount: dailyConsultations.reduce((sum, p) => sum + p.estimatedAmount, 0),
    totalCallbacks: dailyConsultations.reduce((sum, p) => sum + p.callbackCount, 0)
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">일별 보고서를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 및 날짜 선택 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">일별마감보고</h2>
          <p className="text-sm text-gray-600 mt-1">선택한 날짜에 내원한 환자들의 상담 현황입니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={() => {
              filterPatientsByDate();
              filterConsultationsByDate();
            }}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
          {/* 디버깅 버튼 */}
          <button
            onClick={() => {
              console.log('=== 전체 환자 데이터 분석 ===');
              console.log('전체 환자 수:', patients?.length || 0);
              
              // 6월 환자 분석
              const junePatients = patients?.filter(p => p.callInDate?.startsWith('2025-06')) || [];
              console.log('6월 환자 수:', junePatients.length);
              
              // 날짜별 분포 확인
              const dateDistribution: Record<string, number> = {};
              junePatients.forEach(patient => {
                const date = patient.callInDate || 'unknown';
                dateDistribution[date] = (dateDistribution[date] || 0) + 1;
              });
              
              console.log('6월 날짜별 분포:', dateDistribution);
              
              // visitConfirmed 상태 분석
              const visitConfirmedCount = junePatients.filter(p => p.visitConfirmed).length;
              const notVisitConfirmedCount = junePatients.filter(p => !p.visitConfirmed).length;
              console.log('6월 환자 중 visitConfirmed: true =', visitConfirmedCount);
              console.log('6월 환자 중 visitConfirmed: false =', notVisitConfirmedCount);
              
              // 데이터 구조 확인
              if (junePatients.length > 0) {
                console.log('첫 번째 환자 데이터 구조:', junePatients[0]);
              }
            }}
            className="px-3 py-2 text-sm bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100"
          >
            6월 전체 분석
          </button>
          
          {/* 선택된 날짜 상세 분석 */}
          <button
            onClick={() => {
              console.log(`=== ${selectedDate} 상세 분석 ===`);
              const todayPatients = patients?.filter(p => p.callInDate === selectedDate) || [];
              console.log(`${selectedDate} 전체 환자 수:`, todayPatients.length);
              
              todayPatients.forEach((patient, index) => {
                console.log(`${index + 1}. 환자명: ${patient.name}`);
                console.log(`   - callInDate: ${patient.callInDate}`);
                console.log(`   - visitConfirmed: ${patient.visitConfirmed} (타입: ${typeof patient.visitConfirmed})`);
                console.log(`   - status: ${patient.status}`);
                console.log(`   - consultation: ${patient.consultation ? '있음' : '없음'}`);
                console.log('   ---');
              });
              
              const notVisitConfirmedToday = todayPatients.filter(p => !p.visitConfirmed);
              console.log(`${selectedDate} 중 visitConfirmed: false인 환자:`, notVisitConfirmedToday.length);
              console.log('해당 환자들:', notVisitConfirmedToday.map(p => p.name));
            }}
            className="px-3 py-2 text-sm bg-purple-50 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-100"
          >
            선택날짜 분석
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-900">{stats.total}명</div>
          <div className="text-sm text-blue-700">총 내원환자</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-900">{stats.treatmentStarted}명</div>
          <div className="text-sm text-green-700">치료시작</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-900">{stats.treatmentConsented}명</div>
          <div className="text-sm text-blue-700">치료동의</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-900">{stats.callbackNeeded}명</div>
          <div className="text-sm text-yellow-700">재콜백필요</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.terminated}명</div>
          <div className="text-sm text-gray-700">종결</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-900">{formatAmount(stats.totalAmount)}</div>
          <div className="text-sm text-orange-700">총 견적금액</div>
        </div>
      </div>

      {/* 환자 목록 테이블 */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5" />
            {selectedDate}일 내원 환자 목록 ({stats.total}명)
          </h3>
        </div>

        {dailyPatients.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>선택한 날짜에 내원한 환자가 없습니다.</p>
            <p className="text-sm mt-1">다른 날짜를 선택해보세요.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    환자명
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    치료 내용
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    금액
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5">
                    상담내용
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dailyPatients.map((patient) => (
                  <tr key={patient._id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{patient.name}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{patient.treatmentContent}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {patient.estimatedAmount > 0 ? formatAmount(patient.estimatedAmount) : '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(patient.postVisitStatus)}`}>
                        {patient.postVisitStatus}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900 max-w-md">
                        {patient.consultationContent.length > 100 ? (
                          <details className="cursor-pointer">
                            <summary className="font-medium text-blue-600 hover:text-blue-800">
                              {patient.consultationContent.substring(0, 100)}... (더보기)
                            </summary>
                            <div className="mt-2 p-3 bg-gray-50 rounded-lg whitespace-pre-line">
                              {patient.consultationContent}
                            </div>
                          </details>
                        ) : (
                          <div className="whitespace-pre-line">{patient.consultationContent}</div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 하단 요약 */}
      {dailyPatients.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <DollarSign className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">💡 {selectedDate}일 내원 현황 요약</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <p>• 총 {stats.total}명이 내원하여 상담을 진행했습니다.</p>
                <p>• 치료시작 {stats.treatmentStarted}명, 치료동의 {stats.treatmentConsented}명, 재콜백필요 {stats.callbackNeeded}명</p>
                <p>• 총 견적금액: {formatAmount(stats.totalAmount)}</p>
                <p>• 상태미설정 {stats.unset}명 (후속 관리 필요)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 상담관리 환자 목록 테이블 */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="p-4 border-b bg-yellow-50">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <Phone className="w-5 h-5" />
            {selectedDate}일 신규 상담 환자 목록 ({consultationStats.total}명)
          </h3>
        </div>

        {/* 상담관리 통계 카드 */}
        <div className="p-4 bg-gray-50 border-b">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="bg-white border rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-gray-900">{consultationStats.total}명</div>
              <div className="text-xs text-gray-600">총 신규환자</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-red-900">{consultationStats.unprocessedCallback}명</div>
              <div className="text-xs text-red-700">미처리콜백</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-orange-900">{consultationStats.postReservationAbsent}명</div>
              <div className="text-xs text-orange-700">예약후미내원</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-green-900">{consultationStats.visitConfirmed}명</div>
              <div className="text-xs text-green-700">내원확정</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-purple-900">{consultationStats.todayReservation}명</div>
              <div className="text-xs text-purple-700">오늘예약</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-blue-900">{consultationStats.totalCallbacks}회</div>
              <div className="text-xs text-blue-700">총 콜백횟수</div>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-indigo-900">{formatAmount(consultationStats.totalAmount)}</div>
              <div className="text-xs text-indigo-700">총 견적금액</div>
            </div>
          </div>
        </div>

        {dailyConsultations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Phone className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>선택한 날짜에 신규 상담한 환자가 없습니다.</p>
            <p className="text-sm mt-1">다른 날짜를 선택해보세요.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    환자명
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    치료 내용
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    견적 금액
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    총 콜백 횟수
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5">
                    상담내용
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dailyConsultations.map((consultation) => (
                  <tr key={consultation._id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{consultation.name}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{consultation.treatmentContent}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {consultation.estimatedAmount > 0 ? formatAmount(consultation.estimatedAmount) : '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConsultationStatusColor(consultation.status)}`}>
                        {consultation.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 text-center">{consultation.callbackCount}회</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900 max-w-md">
                        {consultation.consultationContent.length > 100 ? (
                          <details className="cursor-pointer">
                            <summary className="font-medium text-blue-600 hover:text-blue-800">
                              {consultation.consultationContent.substring(0, 100)}... (더보기)
                            </summary>
                            <div className="mt-2 p-3 bg-gray-50 rounded-lg whitespace-pre-line">
                              {consultation.consultationContent}
                            </div>
                          </details>
                        ) : (
                          <div className="whitespace-pre-line">{consultation.consultationContent}</div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 상담관리 요약 */}
      {dailyConsultations.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">📞 {selectedDate}일 상담 현황 요약</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <p>• 총 {consultationStats.total}명의 신규 환자가 상담을 받았습니다.</p>
                <p>• 미처리콜백 {consultationStats.unprocessedCallback}명, 예약후미내원 {consultationStats.postReservationAbsent}명 (우선 관리 필요)</p>
                <p>• 내원확정 {consultationStats.visitConfirmed}명, 오늘예약 {consultationStats.todayReservation}명</p>
                <p>• 총 콜백 {consultationStats.totalCallbacks}회, 총 견적금액 {formatAmount(consultationStats.totalAmount)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyReport;