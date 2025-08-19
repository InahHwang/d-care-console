// src/components/reports/RevenueAnalysisSection.tsx - 🔥 매출 현황 분석 섹션 컴포넌트

import React, { useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  Clock, 
  XCircle,
  Target,
  BarChart3,
  TrendingDown
} from 'lucide-react';
import { MonthlyReportData, RevenuePatientDetail } from '@/types/report';
import { 
  formatRevenueAmount, 
  getRevenueTypeColorClass,
  filterPatientsByRevenueType,
  getRevenueProgressSummary 
} from '@/utils/revenueAnalysisUtils';
import { Patient } from '@/types/patient';

interface RevenueAnalysisSectionProps {
  reportData: MonthlyReportData;
  patients?: Patient[]; // 환자 목록 (필터링용)
  onPatientListClick?: (patients: Patient[], title: string) => void; // 환자 목록 모달 콜백
}

const RevenueAnalysisSection: React.FC<RevenueAnalysisSectionProps> = ({ 
  reportData, 
  patients = [],
  onPatientListClick
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const revenueAnalysis = reportData.revenueAnalysis;
  
  if (!revenueAnalysis) return null;

  const { achievedRevenue, potentialRevenue, lostRevenue, summary } = revenueAnalysis;
  
  // 진행 상황별 요약 데이터
  const progressSummary = getRevenueProgressSummary(revenueAnalysis);

  // 환자 목록 클릭 핸들러
  const handlePatientListClick = (
    revenueType: 'achieved' | 'potential' | 'lost',
    subType?: 'consultation_ongoing' | 'visit_management' | 'consultation_lost' | 'visit_lost',
    title?: string
  ) => {
    if (!onPatientListClick || patients.length === 0) return;
    
    const filteredPatients = filterPatientsByRevenueType(patients, revenueType, subType);
    const displayTitle = title || getRevenueTypeTitle(revenueType, subType);
    
    onPatientListClick(filteredPatients, displayTitle);
  };

  // 타이틀 생성 헬퍼
  const getRevenueTypeTitle = (
    revenueType: 'achieved' | 'potential' | 'lost',
    subType?: string
  ): string => {
    switch (revenueType) {
      case 'achieved':
        return '달성매출 환자 명단 (치료시작)';
      case 'potential':
        if (subType === 'consultation_ongoing') return '잠재매출 환자 명단 (상담진행중)';
        if (subType === 'visit_management') return '잠재매출 환자 명단 (내원관리중)';
        return '잠재매출 환자 명단 (전체)';
      case 'lost':
        if (subType === 'consultation_lost') return '손실매출 환자 명단 (상담단계)';
        if (subType === 'visit_lost') return '손실매출 환자 명단 (내원후)';
        return '손실매출 환자 명단 (전체)';
      default:
        return '환자 명단';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6">
      <div className="p-6 border-b bg-blue-50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            매출 현황 분석
            <span className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              총 {summary.totalInquiries}명 문의
            </span>
          </h2>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 no-print"
          >
            {showDetails ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showDetails ? '간단히 보기' : '상세히 보기'}
          </button>
        </div>
      </div>
      
      <div className="p-6">
        {/* 📊 핵심 지표 카드 */}
        <div className="mb-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
            <div className="text-center mb-4">
              <div className="flex items-center justify-center gap-2 mb-3">
                <TrendingUp className="w-8 h-8 text-blue-600" />
                <h3 className="text-2xl font-bold text-gray-900">
                  이번 달 총 {summary.totalInquiries}명의 환자 문의가 있었습니다
                </h3>
              </div>
            </div>
            
            {/* 3개 그룹 메인 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* ✅ 달성매출 */}
              <div 
                className={`${getRevenueTypeColorClass('achieved').bg} ${getRevenueTypeColorClass('achieved').border} border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md`}
                onClick={() => handlePatientListClick('achieved')}
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className={`w-5 h-5 ${getRevenueTypeColorClass('achieved').icon}`} />
                  <span className={`font-medium ${getRevenueTypeColorClass('achieved').text}`}>
                    달성매출
                  </span>
                </div>
                <div className={`text-2xl font-bold mb-1 ${getRevenueTypeColorClass('achieved').text}`}>
                  {achievedRevenue.patients}명 ({achievedRevenue.percentage}%)
                </div>
                <div className={`text-lg font-semibold ${getRevenueTypeColorClass('achieved').text}`}>
                  {formatRevenueAmount(achievedRevenue.amount)}
                </div>
                <div className="text-xs text-gray-600 mt-1">치료시작한 환자들</div>
              </div>

              {/* ⏳ 잠재매출 */}
              <div 
                className={`${getRevenueTypeColorClass('potential').bg} ${getRevenueTypeColorClass('potential').border} border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md`}
                onClick={() => handlePatientListClick('potential')}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Clock className={`w-5 h-5 ${getRevenueTypeColorClass('potential').icon}`} />
                  <span className={`font-medium ${getRevenueTypeColorClass('potential').text}`}>
                    잠재매출
                  </span>
                </div>
                <div className={`text-2xl font-bold mb-1 ${getRevenueTypeColorClass('potential').text}`}>
                  {potentialRevenue.totalPatients}명 ({potentialRevenue.percentage}%)
                </div>
                <div className={`text-lg font-semibold ${getRevenueTypeColorClass('potential').text}`}>
                  {formatRevenueAmount(potentialRevenue.totalAmount)}
                </div>
                <div className="text-xs text-gray-600 mt-1">아직 진행 중인 환자들</div>
              </div>

              {/* ❌ 손실매출 */}
              <div 
                className={`${getRevenueTypeColorClass('lost').bg} ${getRevenueTypeColorClass('lost').border} border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md`}
                onClick={() => handlePatientListClick('lost')}
              >
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className={`w-5 h-5 ${getRevenueTypeColorClass('lost').icon}`} />
                  <span className={`font-medium ${getRevenueTypeColorClass('lost').text}`}>
                    손실매출
                  </span>
                </div>
                <div className={`text-2xl font-bold mb-1 ${getRevenueTypeColorClass('lost').text}`}>
                  {lostRevenue.totalPatients}명 ({lostRevenue.percentage}%)
                </div>
                <div className={`text-lg font-semibold ${getRevenueTypeColorClass('lost').text}`}>
                  {formatRevenueAmount(lostRevenue.totalAmount)}
                </div>
                <div className="text-xs text-gray-600 mt-1">확실히 놓친 환자들</div>
              </div>
            </div>

            {/* 총 잠재매출 표시 */}
            <div className="text-center pt-4 border-t border-blue-200">
              <div className="flex items-center justify-center gap-2 mb-2">
                <DollarSign className="w-6 h-6 text-indigo-600" />
                <span className="text-lg font-semibold text-indigo-900">
                  💰 총 잠재매출: {formatRevenueAmount(summary.totalPotentialAmount)} (100% 성공 시)
                </span>
              </div>
              <div className="text-sm text-indigo-700">
                달성률: <span className="font-bold">{summary.achievementRate}%</span>
                {summary.potentialGrowth > 0 && (
                  <>
                    {' '}• 잠재성장률: <span className="font-bold">+{summary.potentialGrowth}%</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 🎯 가정 시나리오 */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3">
            <Target className="w-6 h-6 text-green-600 mt-1 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                🎯 만약 진행 중인 환자들이 모두 치료를 받는다면...
              </h3>
              <div className="space-y-2 text-green-800">
                <p className="text-base">
                  <span className="font-bold text-xl">{formatRevenueAmount(potentialRevenue.totalAmount)}</span>의 
                  <span className="font-semibold"> 추가 매출</span>이 발생할 것입니다.
                </p>
                <p className="text-sm">
                  • 이는 현재 달성매출 <span className="font-semibold">{formatRevenueAmount(achievedRevenue.amount)}</span>의 
                  <span className="font-bold"> {summary.potentialGrowth}%</span>에 해당합니다.
                </p>
                <p className="text-sm">
                  • 전체 목표매출: <span className="font-bold">{formatRevenueAmount(achievedRevenue.amount + potentialRevenue.totalAmount)}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 📋 상세 분석 (토글 가능) */}
        {showDetails && (
          <div className="space-y-6">
            {/* 🔥 잠재매출 세부 분석 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                잠재매출 세부 분석 ({potentialRevenue.totalPatients}명)
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div 
                  className="text-center p-3 bg-white rounded border cursor-pointer hover:bg-blue-50 transition-colors"
                  onClick={() => handlePatientListClick('potential', 'consultation_ongoing', '잠재매출 - 상담진행중')}
                >
                  <div className="text-xl font-bold text-blue-900">{potentialRevenue.consultation.patients}명</div>
                  <div className="text-blue-700 text-xs mb-1">상담진행중</div>
                  <div className="text-blue-800 font-medium">{formatRevenueAmount(potentialRevenue.consultation.amount)}</div>
                  <div className="text-xs text-gray-600 mt-1">콜백필요, 잠재고객, 예약확정</div>
                </div>
                
                <div 
                  className="text-center p-3 bg-white rounded border cursor-pointer hover:bg-blue-50 transition-colors"
                  onClick={() => handlePatientListClick('potential', 'visit_management', '잠재매출 - 내원관리중')}
                >
                  <div className="text-xl font-bold text-blue-900">{potentialRevenue.visitManagement.patients}명</div>
                  <div className="text-blue-700 text-xs mb-1">내원관리중</div>
                  <div className="text-blue-800 font-medium">{formatRevenueAmount(potentialRevenue.visitManagement.amount)}</div>
                  <div className="text-xs text-gray-600 mt-1">치료동의, 재콜백필요, 상태미설정</div>
                </div>
              </div>
              
              <p className="text-xs text-blue-600 mt-3">
                💡 이 환자들은 아직 치료 가능성이 있는 진행 중인 케이스입니다.
              </p>
            </div>

            {/* 🔥 손실매출 세부 분석 */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                <TrendingDown className="w-5 h-5" />
                손실매출 세부 분석 ({lostRevenue.totalPatients}명)
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div 
                  className="text-center p-3 bg-white rounded border cursor-pointer hover:bg-red-50 transition-colors"
                  onClick={() => handlePatientListClick('lost', 'consultation_lost', '손실매출 - 상담단계')}
                >
                  <div className="text-xl font-bold text-red-900">{lostRevenue.consultation.patients}명</div>
                  <div className="text-red-700 text-xs mb-1">상담단계 손실</div>
                  <div className="text-red-800 font-medium">{formatRevenueAmount(lostRevenue.consultation.amount)}</div>
                  <div className="text-xs text-gray-600 mt-1">종결, 부재중</div>
                </div>
                
                <div 
                  className="text-center p-3 bg-white rounded border cursor-pointer hover:bg-red-50 transition-colors"
                  onClick={() => handlePatientListClick('lost', 'visit_lost', '손실매출 - 내원후')}
                >
                  <div className="text-xl font-bold text-red-900">{lostRevenue.visitManagement.patients}명</div>
                  <div className="text-red-700 text-xs mb-1">내원후 손실</div>
                  <div className="text-red-800 font-medium">{formatRevenueAmount(lostRevenue.visitManagement.amount)}</div>
                  <div className="text-xs text-gray-600 mt-1">내원후 종결</div>
                </div>
              </div>
              
              <p className="text-xs text-red-600 mt-3">
                💡 이 환자들은 확실히 놓친 케이스로, 개선 포인트 분석이 필요합니다.
              </p>
            </div>

            {/* 개선 포인트 제안 */}
            <div className="bg-gray-50 border rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">🎯 매출 증대 포인트</h4>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">1</span>
                  <span><strong>상담진행중 환자 집중 관리:</strong> {potentialRevenue.consultation.patients}명의 콜백/잠재고객 예약 전환율 향상</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">2</span>
                  <span><strong>내원관리중 환자 치료 유도:</strong> {potentialRevenue.visitManagement.patients}명의 치료 결정 촉진</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">3</span>
                  <span><strong>손실 원인 분석:</strong> {lostRevenue.totalPatients}명의 손실 패턴 파악으로 동일 사례 재발 방지</span>
                </div>
                {summary.potentialGrowth > 50 && (
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">🚀</span>
                    <span><strong>높은 성장 잠재력:</strong> 잠재매출이 달성매출의 {summary.potentialGrowth}%이므로 집중 관리 시 큰 효과 기대</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RevenueAnalysisSection;