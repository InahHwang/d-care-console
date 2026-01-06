// src/app/test/daily-report-v2/page.tsx
// 일별 보고서 테스트 페이지 (v2 구조)

'use client'

import React, { useState, useEffect } from 'react'
import { DailyReportResponseV2, DailyReportPatientV2 } from '@/types/patientV2'

export default function DailyReportV2TestPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [reportData, setReportData] = useState<DailyReportResponseV2 | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'consultation' | 'visit'>('consultation')

  const fetchReport = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/test/daily-report-v2?date=${selectedDate}`, {
        credentials: 'include'
      })
      const data = await res.json()
      if (data.success) {
        setReportData(data.data)
      }
    } catch (error) {
      console.error('보고서 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [selectedDate])

  const getResultColor = (result: string | null) => {
    switch (result) {
      case '동의': return 'bg-green-100 text-green-800'
      case '미동의': return 'bg-red-100 text-red-800'
      case '보류': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case '전화상담': return 'bg-blue-100 text-blue-800'
      case '예약확정': return 'bg-green-100 text-green-800'
      case '내원완료': return 'bg-purple-100 text-purple-800'
      case '종결': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case '신규': return 'bg-purple-100 text-purple-800'
      case '콜백필요': return 'bg-yellow-100 text-yellow-800'
      case '부재중': return 'bg-gray-100 text-gray-800'
      case '잠재고객': return 'bg-orange-100 text-orange-800'
      case '재콜백필요': return 'bg-yellow-100 text-yellow-800'
      default: return ''
    }
  }

  const renderPatientRow = (patient: DailyReportPatientV2, isVisit: boolean) => {
    const callbackCount = isVisit ? patient.postVisitCallbackCount : patient.preVisitCallbackCount
    const lastCallback = isVisit ? patient.lastPostVisitCallback : patient.lastPreVisitCallback

    return (
      <tr key={patient.id} className="border-b hover:bg-gray-50">
        <td className="px-3 py-2 text-sm">
          <div className="font-medium">{patient.name}</div>
          <div className="text-xs text-gray-500">{patient.gender} {patient.age}세</div>
        </td>
        <td className="px-3 py-2 text-sm">{patient.phone}</td>
        <td className="px-3 py-2">
          <span className={`text-xs px-2 py-0.5 rounded ${getPhaseColor(patient.phase)}`}>
            {patient.phase}
          </span>
          {patient.currentStatus && (
            <span className={`text-xs px-2 py-0.5 rounded ml-1 ${getStatusColor(patient.currentStatus)}`}>
              {patient.currentStatus}
            </span>
          )}
          {patient.result && (
            <span className={`text-xs px-2 py-0.5 rounded ml-1 ${getResultColor(patient.result)}`}>
              {patient.result}
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-sm">{patient.treatment}</td>
        <td className="px-3 py-2 text-sm">
          <div className="flex items-center gap-1">
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
              callbackCount === 0 ? 'bg-gray-100 text-gray-500' :
              callbackCount === 1 ? 'bg-blue-100 text-blue-800' :
              callbackCount === 2 ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {callbackCount}차
            </span>
            {lastCallback && (
              <span className="text-xs text-gray-500">
                ({lastCallback.result})
              </span>
            )}
          </div>
          {lastCallback && lastCallback.notes && (
            <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[150px]" title={lastCallback.notes}>
              {lastCallback.notes}
            </div>
          )}
        </td>
        <td className="px-3 py-2 text-sm">
          {patient.originalAmount > 0 ? (
            <div>
              <div className="font-medium">{patient.finalAmount}만</div>
              {patient.discountRate > 0 && (
                <div className="text-xs text-red-500">-{patient.discountRate}%</div>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400">-</span>
          )}
        </td>
        <td className="px-3 py-2 text-sm">
          {patient.resultReason && (
            <span className="text-xs text-orange-600">{patient.resultReason}</span>
          )}
          {patient.correctionPlan && (
            <div className="text-xs text-blue-600">{patient.correctionPlan}</div>
          )}
        </td>
        <td className="px-3 py-2 text-sm text-gray-500">{patient.counselorName}</td>
      </tr>
    )
  }

  if (loading) {
    return <div className="p-8 text-center">로딩 중...</div>
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">일별 보고서 v2 테스트</h1>
              <p className="text-sm text-gray-500">상담관리 + 내원관리 통합 보고서</p>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border rounded px-3 py-2"
              />
              <a
                href="/test/consultation-v2"
                className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                ← 상담관리
              </a>
              <a
                href="/test/visit-v2"
                className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                내원관리 →
              </a>
            </div>
          </div>
        </div>
      </div>

      {reportData && (
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* 요약 카드 */}
          <div className="grid grid-cols-6 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">전체 환자</div>
              <div className="text-2xl font-bold">{reportData.summary.total}명</div>
            </div>

            <div className="bg-blue-50 rounded-lg shadow p-4">
              <div className="text-sm text-blue-600">상담관리</div>
              <div className="text-2xl font-bold text-blue-700">
                {reportData.summary.consultation.total}명
              </div>
              <div className="text-xs text-blue-500 mt-1">
                신규 {reportData.summary.consultation.newPatients} |
                예약 {reportData.summary.consultation.reservationConfirmed}
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg shadow p-4">
              <div className="text-sm text-purple-600">내원관리</div>
              <div className="text-2xl font-bold text-purple-700">
                {reportData.summary.visit.total}명
              </div>
              <div className="text-xs text-purple-500 mt-1">
                동의 {reportData.summary.visit.agreed} |
                미동의 {reportData.summary.visit.disagreed} |
                보류 {reportData.summary.visit.pending}
              </div>
            </div>

            <div className="bg-green-50 rounded-lg shadow p-4">
              <div className="text-sm text-green-600">예상 매출</div>
              <div className="text-2xl font-bold text-green-700">
                {reportData.summary.expectedRevenue}만
              </div>
            </div>

            <div className="bg-emerald-50 rounded-lg shadow p-4">
              <div className="text-sm text-emerald-600">실제 매출</div>
              <div className="text-2xl font-bold text-emerald-700">
                {reportData.summary.actualRevenue}만
              </div>
              {reportData.summary.totalDiscount > 0 && (
                <div className="text-xs text-red-500 mt-1">
                  할인 -{reportData.summary.totalDiscount}만 ({reportData.summary.avgDiscountRate}%)
                </div>
              )}
            </div>

            <div className="bg-yellow-50 rounded-lg shadow p-4">
              <div className="text-sm text-yellow-600">콜백 현황</div>
              <div className="text-xl font-bold text-yellow-700">
                전화 {reportData.summary.preVisitCallbackCount}회
              </div>
              <div className="text-xs text-yellow-500 mt-1">
                내원후 {reportData.summary.postVisitCallbackCount}회
              </div>
            </div>
          </div>

          {/* 탭 */}
          <div className="bg-white rounded-lg shadow">
            <div className="border-b">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('consultation')}
                  className={`px-6 py-3 text-sm font-medium ${
                    activeTab === 'consultation'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  상담관리 ({reportData.consultationPatients.length})
                </button>
                <button
                  onClick={() => setActiveTab('visit')}
                  className={`px-6 py-3 text-sm font-medium ${
                    activeTab === 'visit'
                      ? 'border-b-2 border-purple-500 text-purple-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  내원관리 ({reportData.visitPatients.length})
                </button>
              </div>
            </div>

            {/* 테이블 */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">환자</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">연락처</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">상태</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">치료 내용</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                      {activeTab === 'consultation' ? '전화 콜백' : '내원후 콜백'}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">견적</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">사유/계획</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">담당</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTab === 'consultation' ? (
                    reportData.consultationPatients.length > 0 ? (
                      reportData.consultationPatients.map(p => renderPatientRow(p, false))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                          상담관리 환자가 없습니다
                        </td>
                      </tr>
                    )
                  ) : (
                    reportData.visitPatients.length > 0 ? (
                      reportData.visitPatients.map(p => renderPatientRow(p, true))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                          내원관리 환자가 없습니다
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 보고서 정보 */}
          <div className="mt-4 text-center text-sm text-gray-500">
            {reportData.clinicName} | {reportData.date} ({reportData.dayOfWeek})
          </div>
        </div>
      )}
    </div>
  )
}
