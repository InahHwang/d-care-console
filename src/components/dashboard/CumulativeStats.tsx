// src/components/dashboard/CumulativeStats.tsx
'use client'

import { useState, useEffect } from 'react'
import PatientListModal from './PatientListModal'
import { PatientFilterType } from '@/types/patient'
import { Patient } from '@/types/patient'

export default function CumulativeStats() {
  // 🚨 강제 디버깅
  console.log('🚨 CumulativeStats 컴포넌트가 렌더링되었습니다!')
  
  // 🔥 Redux 대신 로컬 상태로 전체 환자 데이터 관리
  const [allPatients, setAllPatients] = useState<Patient[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // 모달 상태 관리
  const [modalState, setModalState] = useState<{
    isOpen: boolean
    filterType: PatientFilterType | null
    title: string
  }>({
    isOpen: false,
    filterType: null,
    title: ''
  })

  // 🔥 컴포넌트 마운트 시 전체 누적 데이터 가져오기
  useEffect(() => {
    console.log('🚨 useEffect 실행됨 - CumulativeStats')
    
    const fetchAllPatients = async () => {
      try {
        console.log('🚨 fetchAllPatients 함수 시작')
        setIsLoading(true)
        setError(null)
        
        console.log('🔍 전체 누적 환자 데이터 요청 시작')
        console.log('🔍 요청 URL:', '/api/patients/cumulative')
        
        const response = await fetch('/api/patients/cumulative', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        
        console.log('🔍 응답 상태:', response.status, response.statusText)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('🔍 응답 에러 내용:', errorText)
          throw new Error(`API 응답 오류: ${response.status} - ${errorText}`)
        }
        
        const data = await response.json()
        console.log('🔍 응답 데이터 전체:', data)
        console.log('🔍 응답 데이터 성공 플래그:', data.success)
        console.log('🔍 응답 데이터 환자 배열:', data.patients)
        console.log('🔍 환자 배열 길이:', Array.isArray(data.patients) ? data.patients.length : 'not array')
        
        if (!data.success) {
          console.error('🔍 API 성공 플래그 false:', data)
          throw new Error(data.error || '데이터 조회 실패')
        }
        
        // 안전하게 patients 배열 확인
        const patients = Array.isArray(data.patients) ? data.patients : []
        console.log('🔍 최종 설정할 환자 데이터:', patients.length, '명')
        
        setAllPatients(patients)
        
      } catch (error) {
        console.error('🔍 전체 누적 환자 데이터 로드 실패:', error)
        setError(error instanceof Error ? error.message : '데이터 로드에 실패했습니다')
        setAllPatients([])
      } finally {
        console.log('🔍 로딩 상태 false로 변경')
        setIsLoading(false)
      }
    }

    fetchAllPatients()
  }, [])

  // 전체 누적 통계 계산 (기존 로직과 동일하되 allPatients 사용)
  const getCumulativeStats = () => {
    if (allPatients.length === 0) {
      return {
        totalInquiries: { count: 0, inboundCount: 0, outboundCount: 0 },
        appointmentRate: { value: 0, count: 0 },
        visitRate: { value: 0, count: 0 },
        paymentRate: { value: 0, count: 0 },
        totalTreatmentAmount: { amount: 0, count: 0 }
      }
    }

    // 전체 환자 중 각 단계별 환자 수 (allPatients 사용)
    const reservedPatients = allPatients.filter(p => p.status === '예약확정')
    const visitedPatients = allPatients.filter(p => p.visitConfirmed === true)
    const treatmentStartedPatients = allPatients.filter(p => p.postVisitStatus === '치료시작')
    
    // 인바운드/아웃바운드 구분 (allPatients 사용)
    const inboundPatients = allPatients.filter(p => p.consultationType === 'inbound')
    const outboundPatients = allPatients.filter(p => p.consultationType === 'outbound')
    
    // 전환율 계산 (allPatients 사용)
    const reservationRate = allPatients.length > 0 ? (reservedPatients.length / allPatients.length) * 100 : 0
    const visitRate = allPatients.length > 0 ? (visitedPatients.length / allPatients.length) * 100 : 0
    const treatmentRate = allPatients.length > 0 ? (treatmentStartedPatients.length / allPatients.length) * 100 : 0
    
    // 🔥 치료금액 합계 계산 - Patient 타입의 실제 필드 사용
    const totalTreatmentAmount = treatmentStartedPatients.reduce((sum, patient) => {
      // consultation.estimatedAmount 또는 postVisitConsultation.estimateInfo.discountPrice 사용
      const treatmentAmount = patient.postVisitConsultation?.estimateInfo?.discountPrice || 
                              patient.consultation?.estimatedAmount || 0;
      return sum + treatmentAmount;
    }, 0)

    return {
      totalInquiries: {
        count: allPatients.length,
        inboundCount: inboundPatients.length,
        outboundCount: outboundPatients.length
      },
      appointmentRate: {
        value: Math.round(reservationRate * 10) / 10,
        count: reservedPatients.length
      },
      visitRate: {
        value: Math.round(visitRate * 10) / 10,
        count: visitedPatients.length
      },
      paymentRate: {
        value: Math.round(treatmentRate * 10) / 10,
        count: treatmentStartedPatients.length
      },
      totalTreatmentAmount: {
        amount: totalTreatmentAmount,
        count: treatmentStartedPatients.length
      }
    }
  }

  const stats = getCumulativeStats()

  // 🔥 전체 누적에서는 모달을 단순화하거나 다른 방식 사용
  const handleOpenModal = (filterType: string, title: string) => {
    // 전체 누적에서는 관리 페이지로 이동하거나 간단한 알림 표시
    alert(`${title} 데이터입니다.\n\n전체 ${stats.totalInquiries.count}명의 환자가 등록되어 있습니다.\n\n상세 내용은 환자 관리 페이지에서 확인하세요.`)
    
    // 또는 환자 관리 페이지로 이동
    // router.push('/management')
  }

  const handleCloseModal = () => {
    // 모달을 사용하지 않으므로 빈 함수
  }

  // 🔥 로딩 상태 처리
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-4"></div>
            <div className="h-8 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded mb-4"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    )
  }

  // 🔥 에러 상태 처리
  if (error) {
    return (
      <div className="card p-6 text-center">
        <div className="text-red-500 mb-2">데이터 로드 실패</div>
        <div className="text-sm text-gray-500">{error}</div>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
        >
          다시 시도
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 전체 신규 문의 카드 */}
        <div 
          className="card p-4 cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-primary transition-all duration-200"
          onClick={() => handleOpenModal('all_patients', '전체 등록 환자')}
        >
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-text-secondary">전체 신규 문의</h3>
              <span className="text-xs text-primary">클릭하여 보기</span>
            </div>
            <div className="flex items-baseline">
              <span className="text-3xl font-bold text-text-primary">{stats.totalInquiries.count}</span>
              <span className="ml-2 text-sm text-text-secondary">건</span>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              인바운드: {stats.totalInquiries.inboundCount}건, 
              아웃바운드: {stats.totalInquiries.outboundCount}건
            </div>
            <div className="mt-2 h-8 bg-gray-50 rounded-md"></div>
          </div>
        </div>

        {/* 예약 전환율 카드 */}
        <div 
          className="card p-4 cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-primary transition-all duration-200"
          onClick={() => handleOpenModal('all_reservations', '예약 전환 환자 (전체)')}
        >
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-text-secondary">예약전환율</h3>
              <span className="text-xs text-primary">클릭하여 보기</span>
            </div>
            <div className="flex items-baseline">
              <span className="text-3xl font-bold text-text-primary">{stats.appointmentRate.value}</span>
              <span className="ml-2 text-sm text-text-secondary">%</span>
            </div>
            <div className="mt-2 text-xs text-text-muted">
              {stats.appointmentRate.count}명 예약전환
            </div>
            <div className="mt-2 h-8 bg-gray-50 rounded-md"></div>
          </div>
        </div>

        {/* 내원 전환율 카드 */}
        <div 
          className="card p-4 cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-primary transition-all duration-200"
          onClick={() => handleOpenModal('all_visits', '내원 완료 환자 (전체)')}
        >
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-text-secondary">내원전환율</h3>
              <span className="text-xs text-primary">클릭하여 보기</span>
            </div>
            <div className="flex items-baseline">
              <span className="text-3xl font-bold text-text-primary">{stats.visitRate.value}</span>
              <span className="ml-2 text-sm text-text-secondary">%</span>
            </div>
            <div className="mt-2 text-xs text-text-muted">
              {stats.visitRate.count}명 내원완료
            </div>
            <div className="mt-2 h-8 bg-gray-50 rounded-md"></div>
          </div>
        </div>

        {/* 결제전환율 & 치료금액 카드 */}
        <div 
          className="card p-4 bg-gradient-to-br from-orange-50 to-indigo-50 border-2 border-orange-200 cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-orange-400 transition-all duration-200"
          onClick={() => handleOpenModal('all_treatments', '치료 시작 환자 (전체)')}
        >
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-orange-700">결제전환율</h3>
              <span className="text-xs text-orange-600">클릭하여 보기</span>
            </div>
            
            {/* 결제전환율 표시 */}
            <div className="flex items-baseline">
              <span className="text-3xl font-bold text-orange-800">{stats.paymentRate.value}</span>
              <span className="ml-2 text-sm text-orange-600">%</span>
            </div>
            
            {/* 결제전환 환자수 */}
            <div className="mt-2 text-xs text-orange-600">
              {stats.paymentRate.count}명 치료시작
            </div>
            
            {/* 전체 치료금액 표시 */}
            <div className="mt-3 bg-white/70 rounded-lg p-2 border border-orange-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-orange-700">전체 치료금액</span>
              </div>
              
              <div className="flex items-baseline">
                <span className="text-lg font-bold text-orange-900">
                  {stats.totalTreatmentAmount.amount.toLocaleString()}
                </span>
                <span className="ml-1 text-xs text-orange-600">원</span>
              </div>
              
              {/* 평균 치료비 표시 */}
              {stats.totalTreatmentAmount.count > 0 && (
                <div className="mt-1 pt-1 border-t border-orange-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-orange-600">평균 치료비</span>
                    <span className="text-xs font-medium text-orange-800">
                      {Math.round(stats.totalTreatmentAmount.amount / stats.totalTreatmentAmount.count).toLocaleString()}원
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 🔥 전체 누적에서는 모달 대신 간단한 알림 사용 */}
      {/* 
      기존 PatientListModal은 Redux 기반이므로 전체 누적에서는 사용하지 않음
      필요시 별도의 모달 컴포넌트 구현 또는 환자 관리 페이지로 이동
      */}
    </>
  )
}