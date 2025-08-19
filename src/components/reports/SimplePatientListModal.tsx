// src/components/reports/SimplePatientListModal.tsx - 🔥 매출 현황 분석용 간단한 환자 목록 모달

import React from 'react';
import { X, Phone, Calendar, User, DollarSign } from 'lucide-react';
import { Patient } from '@/types/patient';
import { formatRevenueAmount } from '@/utils/revenueAnalysisUtils';

interface SimplePatientListModalProps {
  patients: Patient[];
  title: string;
  onClose: () => void;
}

const SimplePatientListModal: React.FC<SimplePatientListModalProps> = ({
  patients,
  title,
  onClose
}) => {
  // 환자의 예상 견적 금액 계산 (revenueAnalysisUtils와 동일 로직)
  const getPatientEstimatedAmount = (patient: Patient): number => {
    let estimatedAmount = 0;
    
    // 1. 내원 후 상담 정보의 견적이 있는 경우 (우선순위 1)
    if (patient.postVisitConsultation?.estimateInfo) {
      const estimate = patient.postVisitConsultation.estimateInfo;
      
      if (estimate.discountPrice && estimate.discountPrice > 0) {
        estimatedAmount = estimate.discountPrice;
      } else if (estimate.regularPrice && estimate.regularPrice > 0) {
        estimatedAmount = estimate.regularPrice;
      }
    }
    // 2. 기존 상담 정보의 견적이 있는 경우 (우선순위 2)
    else if (patient.consultation?.estimatedAmount) {
      estimatedAmount = patient.consultation.estimatedAmount;
    }
    // 3. 직접 입력된 치료금액이 있는 경우 (우선순위 3)
    else if (patient.treatmentCost && patient.treatmentCost > 0) {
      estimatedAmount = patient.treatmentCost;
    }
    
    return estimatedAmount;
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case '콜백필요':
        return 'bg-yellow-100 text-yellow-800';
      case '부재중':
        return 'bg-red-100 text-red-800';
      case '잠재고객':
        return 'bg-green-100 text-green-800';
      case 'VIP':
        return 'bg-purple-100 text-purple-800';
      case '예약확정':
        return 'bg-indigo-100 text-indigo-800';
      case '재예약확정':
        return 'bg-indigo-100 text-indigo-800';
      case '종결':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPostVisitStatusBadgeColor = (postVisitStatus?: string) => {
    switch (postVisitStatus) {
      case '재콜백필요':
        return 'bg-orange-100 text-orange-800';
      case '치료동의':
        return 'bg-green-100 text-green-800';
      case '치료시작':
        return 'bg-blue-100 text-blue-800';
      case '종결':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-purple-100 text-purple-800';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatPhoneNumber = (phoneNumber: string) => {
    return phoneNumber.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  };

  // 총 견적 금액 계산
  const totalEstimatedAmount = patients.reduce((sum, patient) => {
    return sum + getPatientEstimatedAmount(patient);
  }, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl mx-4 max-h-[80vh] overflow-hidden">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              {patients.length}명
            </span>
            {totalEstimatedAmount > 0 && (
              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                {formatRevenueAmount(totalEstimatedAmount)} 예상
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 모달 콘텐츠 */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {patients.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-2">해당하는 환자가 없습니다.</div>
              <div className="text-sm text-gray-400">조건에 맞는 환자 데이터가 없습니다.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {patients.map((patient) => {
                const estimatedAmount = getPatientEstimatedAmount(patient);
                
                return (
                  <div
                    key={patient._id || patient.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-medium text-gray-900">{patient.name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(patient.status)}`}>
                          {patient.status}
                        </span>
                        
                        {/* 내원 관리 상태 표시 */}
                        {patient.visitConfirmed && patient.postVisitStatus && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPostVisitStatusBadgeColor(patient.postVisitStatus)}`}>
                            {patient.postVisitStatus}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {patient.patientId}
                      </div>
                    </div>

                    {/* 기본 정보 그리드 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-600 mb-3">
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 mr-2 text-gray-400" />
                        {formatPhoneNumber(patient.phoneNumber)}
                      </div>
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                        문의일: {formatDate(patient.callInDate)}
                      </div>
                      {estimatedAmount > 0 && (
                        <div className="flex items-center">
                          <DollarSign className="w-4 h-4 mr-2 text-gray-400" />
                          견적: {formatRevenueAmount(estimatedAmount)}
                        </div>
                      )}
                    </div>

                    {/* 관심 서비스 태그 */}
                    {patient.interestedServices && patient.interestedServices.length > 0 && (
                      <div className="mb-2">
                        <div className="flex flex-wrap gap-1">
                          {patient.interestedServices.slice(0, 3).map((service, index) => (
                            <span key={index} className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded">
                              {service}
                            </span>
                          ))}
                          {patient.interestedServices.length > 3 && (
                            <span className="px-2 py-1 bg-gray-50 text-gray-500 text-xs rounded">
                              +{patient.interestedServices.length - 3}개
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 메모 표시 */}
                    {(patient.notes || patient.memo) && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                        <span className="font-medium">메모: </span>
                        {patient.notes || patient.memo}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 모달 푸터 */}
        <div className="flex justify-between items-center p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            총 <span className="font-semibold text-gray-900">{patients.length}명</span>
            {totalEstimatedAmount > 0 && (
              <>
                {' '}• 예상 매출: <span className="font-semibold text-green-600">{formatRevenueAmount(totalEstimatedAmount)}</span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default SimplePatientListModal;