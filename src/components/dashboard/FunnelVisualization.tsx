// src/components/dashboard/FunnelVisualization.tsx
'use client'

import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import { useState } from 'react'
import PatientListModal from './PatientListModal'
import { PatientFilterType } from '@/store/slices/patientsSlice'

interface FunnelStage {
  id: string
  name: string
  count: number
  percentage: number
  color: string
  filterType: PatientFilterType
}

export default function FunnelVisualization() {
  const { patients } = useSelector((state: RootState) => state.patients)
  
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

  // 이번달 환자 필터링
  const getThisMonthPatients = () => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    const firstDayOfMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
    const todayStr = now.toISOString().split('T')[0]
    
    return patients.filter(patient => {
      const callInDate = patient.callInDate
      return callInDate >= firstDayOfMonthStr && callInDate <= todayStr
    })
  }

  // 퍼널 단계별 데이터 계산
  const getFunnelData = (): FunnelStage[] => {
    const thisMonthPatients = getThisMonthPatients()
    const totalCount = thisMonthPatients.length
    
    if (totalCount === 0) {
      return [
        { id: 'inquiry', name: '신규 문의', count: 0, percentage: 0, color: 'bg-blue-500', filterType: 'new_inquiry' },
        { id: 'reservation', name: '예약 전환', count: 0, percentage: 0, color: 'bg-green-500', filterType: 'reservation_rate' },
        { id: 'visit', name: '내원 완료', count: 0, percentage: 0, color: 'bg-purple-500', filterType: 'visit_rate' },
        { id: 'treatment', name: '치료 시작', count: 0, percentage: 0, color: 'bg-orange-500', filterType: 'treatment_rate' }
      ]
    }

    const reservedCount = thisMonthPatients.filter(p => p.status === '예약확정').length
    const visitedCount = thisMonthPatients.filter(p => p.visitConfirmed === true).length
    const treatmentCount = thisMonthPatients.filter(p => p.postVisitStatus === '치료시작').length

    return [
      {
        id: 'inquiry',
        name: '신규 문의',
        count: totalCount,
        percentage: 100,
        color: 'bg-blue-500',
        filterType: 'new_inquiry'
      },
      {
        id: 'reservation',
        name: '예약 전환',
        count: reservedCount,
        percentage: Math.round((reservedCount / totalCount) * 100 * 10) / 10,
        color: 'bg-green-500',
        filterType: 'reservation_rate'
      },
      {
        id: 'visit',
        name: '내원 완료',
        count: visitedCount,
        percentage: Math.round((visitedCount / totalCount) * 100 * 10) / 10,
        color: 'bg-purple-500',
        filterType: 'visit_rate'
      },
      {
        id: 'treatment',
        name: '치료 시작',
        count: treatmentCount,
        percentage: Math.round((treatmentCount / totalCount) * 100 * 10) / 10,
        color: 'bg-orange-500',
        filterType: 'treatment_rate'
      }
    ]
  }

  const funnelStages = getFunnelData()
  const maxCount = Math.max(...funnelStages.map(stage => stage.count))

  // 모달 핸들러
  const handleStageClick = (stage: FunnelStage) => {
    setModalState({
      isOpen: true,
      filterType: stage.filterType,
      title: `${stage.name} 환자 목록`
    })
  }

  const handleCloseModal = () => {
    setModalState({
      isOpen: false,
      filterType: null,
      title: ''
    })
  }

  return (
    <>
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-text-primary">이번달 전환 퍼널</h3>
          <div className="text-sm text-text-secondary">
            클릭하여 상세 환자 목록 확인
          </div>
        </div>

        <div className="space-y-4">
          {funnelStages.map((stage, index) => {
            const width = maxCount > 0 ? (stage.count / maxCount) * 100 : 0
            const isLast = index === funnelStages.length - 1
            
            return (
              <div key={stage.id} className="relative">
                {/* 퍼널 바 */}
                <div 
                  className={`relative cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] rounded-lg overflow-hidden ${
                    stage.count === 0 ? 'opacity-50' : ''
                  }`}
                  onClick={() => stage.count > 0 && handleStageClick(stage)}
                  style={{ 
                    width: `${Math.max(width, 20)}%`,
                    marginLeft: `${(100 - Math.max(width, 20)) / 2}%`
                  }}
                >
                  <div className={`${stage.color} h-16 relative`}>
                    {/* 단계 정보 */}
                    <div className="absolute inset-0 flex items-center justify-between px-4 text-white">
                      <div>
                        <div className="font-semibold text-sm">{stage.name}</div>
                        <div className="text-xs opacity-90">{stage.count}명</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">{stage.percentage}%</div>
                        {index > 0 && (
                          <div className="text-xs opacity-90">
                            전환율
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 연결선 (마지막 단계가 아닌 경우) */}
                {!isLast && (
                  <div className="flex justify-center mt-2 mb-2">
                    <div className="w-0.5 h-4 bg-gray-300"></div>
                  </div>
                )}

                {/* 단계 간 전환률 표시 */}
                {!isLast && index < funnelStages.length - 1 && (
                  <div className="flex justify-center mb-2">
                    <div className="bg-gray-100 px-3 py-1 rounded-full text-xs text-gray-600">
                      {funnelStages[index + 1].count > 0 && stage.count > 0
                        ? `${Math.round((funnelStages[index + 1].count / stage.count) * 100 * 10) / 10}% 전환`
                        : '0% 전환'
                      }
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 요약 정보 */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {funnelStages.map((stage) => (
              <div key={`summary-${stage.id}`} className="space-y-1">
                <div className={`w-4 h-4 ${stage.color} rounded-full mx-auto`}></div>
                <div className="text-xs text-text-secondary">{stage.name}</div>
                <div className="font-semibold text-sm text-text-primary">{stage.count}명</div>
              </div>
            ))}
          </div>
        </div>

        {/* 전체 전환율 요약 */}
        {funnelStages[0].count > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-sm text-text-secondary mb-1">전체 전환율 (문의 → 치료시작)</div>
              <div className="text-2xl font-bold text-primary">
                {Math.round((funnelStages[3].count / funnelStages[0].count) * 100 * 10) / 10}%
              </div>
              <div className="text-xs text-text-muted mt-1">
                {funnelStages[0].count}명 중 {funnelStages[3].count}명이 치료를 시작했습니다
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 환자 목록 모달 */}
      {modalState.filterType && (
        <PatientListModal
          isOpen={modalState.isOpen}
          onClose={handleCloseModal}
          filterType={modalState.filterType}
          title={modalState.title}
        />
      )}
    </>
  )
}