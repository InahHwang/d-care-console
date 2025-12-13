// src/components/management/ReferralTab.tsx
// 환자 상세 모달 내 소개관리 탭

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Patient } from '@/store/slices/patientsSlice'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import {
  HiOutlineUserAdd,
  HiOutlineUserGroup,
  HiOutlineCheck,
  HiOutlineSearch,
  HiOutlineTrash,
  HiOutlineRefresh,
  HiOutlineGift,
  HiOutlineBell,
  HiOutlineX
} from 'react-icons/hi'
import { Icon } from '../common/Icon'

interface Referral {
  _id: string
  referrerId: string
  referrerName: string
  referrerPhone: string
  referredId: string
  referredName: string
  referredPhone: string
  referralDate: string
  referredStatus: 'registered' | 'visited' | 'treating' | 'completed'
  treatmentType?: string
  thanksSent: boolean
  thanksSentDate?: string
  nextVisitAlert: boolean
  alertMessage?: string
  notes?: string
  createdAt: string
}

interface ReferralTabProps {
  patient: Patient
}

export default function ReferralTab({ patient }: ReferralTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'asReferrer' | 'asReferred'>('asReferrer')
  const [referralsAsReferrer, setReferralsAsReferrer] = useState<Referral[]>([])
  const [referralsAsReferred, setReferralsAsReferred] = useState<Referral[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Patient[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedPatientForReferral, setSelectedPatientForReferral] = useState<Patient | null>(null)

  const patientId = patient._id || patient.id

  // 소개 데이터 조회
  const fetchReferrals = useCallback(async () => {
    try {
      setIsLoading(true)

      // 이 환자가 소개자인 경우 (소개해준 환자들)
      const asReferrerResponse = await fetch(`/api/referrals?type=detail&referrerId=${patientId}`)
      const asReferrerData = await asReferrerResponse.json()

      if (asReferrerData.success && asReferrerData.data?.referrals) {
        setReferralsAsReferrer(asReferrerData.data.referrals)
      }

      // 이 환자가 피소개자인 경우 (소개받은 환자 - 누가 소개해줬는지)
      const allReferralsResponse = await fetch(`/api/referrals?search=${encodeURIComponent(patient.name)}`)
      const allReferralsData = await allReferralsResponse.json()

      if (allReferralsData.success && allReferralsData.data) {
        const asReferred = allReferralsData.data.filter(
          (r: Referral) => r.referredId === patientId
        )
        setReferralsAsReferred(asReferred)
      }
    } catch (error) {
      console.error('소개 데이터 조회 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }, [patientId, patient.name])

  useEffect(() => {
    fetchReferrals()
  }, [fetchReferrals])

  // 환자 검색
  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    try {
      setIsSearching(true)
      const response = await fetch(`/api/patients?search=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()

      if (data.success && data.patients) {
        // 현재 환자 제외
        const filtered = data.patients.filter((p: Patient) =>
          (p._id || p.id) !== patientId
        )
        setSearchResults(filtered)
      }
    } catch (error) {
      console.error('환자 검색 실패:', error)
    } finally {
      setIsSearching(false)
    }
  }

  // 소개 등록
  const handleRegisterReferral = async () => {
    if (!selectedPatientForReferral) {
      alert('소개할 환자를 선택해주세요.')
      return
    }

    try {
      const response = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referrerId: patientId,
          referrerName: patient.name,
          referrerPhone: patient.phoneNumber,
          referredId: selectedPatientForReferral._id || selectedPatientForReferral.id,
          referredName: selectedPatientForReferral.name,
          referredPhone: selectedPatientForReferral.phoneNumber,
          referralDate: new Date().toISOString()
        })
      })

      const data = await response.json()
      if (data.success) {
        alert('소개 기록이 등록되었습니다.')
        setShowAddModal(false)
        setSelectedPatientForReferral(null)
        setSearchQuery('')
        setSearchResults([])
        fetchReferrals()
      } else {
        alert(data.error || '등록에 실패했습니다.')
      }
    } catch (error) {
      console.error('소개 등록 실패:', error)
      alert('등록 중 오류가 발생했습니다.')
    }
  }

  // 감사인사 완료 처리
  const handleMarkThanksSent = async (referralId: string) => {
    if (!confirm('감사인사를 전달하셨나요?')) return

    try {
      const response = await fetch('/api/referrals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: referralId,
          action: 'markThanksSent'
        })
      })

      const data = await response.json()
      if (data.success) {
        fetchReferrals()
      }
    } catch (error) {
      console.error('감사인사 처리 실패:', error)
    }
  }

  // 소개 삭제
  const handleDeleteReferral = async (referralId: string) => {
    if (!confirm('이 소개 기록을 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/referrals?id=${referralId}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      if (data.success) {
        fetchReferrals()
      }
    } catch (error) {
      console.error('소개 삭제 실패:', error)
    }
  }

  const getStatusBadge = (status: Referral['referredStatus']) => {
    switch (status) {
      case 'registered':
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">등록</span>
      case 'visited':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">내원</span>
      case 'treating':
        return <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">치료중</span>
      case 'completed':
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">완료</span>
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">소개 관리</h3>
          <p className="text-sm text-text-secondary">환자 소개 기록 및 감사인사 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchReferrals}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="새로고침"
          >
            <Icon icon={HiOutlineRefresh} size={18} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            <Icon icon={HiOutlineUserAdd} size={18} />
            <span>소개 환자 등록</span>
          </button>
        </div>
      </div>

      {/* 통계 요약 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{referralsAsReferrer.length}</div>
          <div className="text-sm text-blue-800">소개해준 환자</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{referralsAsReferred.length}</div>
          <div className="text-sm text-green-800">소개받은 경우</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">
            {referralsAsReferrer.filter(r => !r.thanksSent).length}
          </div>
          <div className="text-sm text-orange-800">미전달 감사인사</div>
        </div>
      </div>

      {/* 서브 탭 */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveSubTab('asReferrer')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeSubTab === 'asReferrer'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon icon={HiOutlineUserGroup} size={16} />
              소개해준 환자 ({referralsAsReferrer.length})
            </div>
          </button>
          <button
            onClick={() => setActiveSubTab('asReferred')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeSubTab === 'asReferred'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon icon={HiOutlineGift} size={16} />
              누가 소개해줬나 ({referralsAsReferred.length})
            </div>
          </button>
        </div>
      </div>

      {/* 소개해준 환자 목록 */}
      {activeSubTab === 'asReferrer' && (
        <div className="space-y-3">
          {referralsAsReferrer.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Icon icon={HiOutlineUserGroup} size={48} className="mx-auto mb-3 text-gray-300" />
              <p>이 환자가 소개해준 환자가 없습니다.</p>
            </div>
          ) : (
            referralsAsReferrer.map((referral) => (
              <div
                key={referral._id}
                className={`border rounded-lg p-4 ${
                  !referral.thanksSent
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon icon={HiOutlineUserAdd} size={24} className="text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{referral.referredName}</span>
                        {getStatusBadge(referral.referredStatus)}
                        {!referral.thanksSent && (
                          <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1">
                            <Icon icon={HiOutlineBell} size={12} />
                            감사인사 미전달
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{referral.referredPhone}</p>
                      <p className="text-xs text-gray-500">
                        소개일: {format(new Date(referral.referralDate), 'yyyy년 M월 d일', { locale: ko })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!referral.thanksSent ? (
                      <button
                        onClick={() => handleMarkThanksSent(referral._id)}
                        className="flex items-center gap-1 px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm"
                      >
                        <Icon icon={HiOutlineGift} size={16} />
                        감사인사 완료
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm">
                        <Icon icon={HiOutlineCheck} size={16} />
                        감사인사 완료
                      </span>
                    )}
                    <button
                      onClick={() => handleDeleteReferral(referral._id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="삭제"
                    >
                      <Icon icon={HiOutlineTrash} size={18} />
                    </button>
                  </div>
                </div>

                {referral.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-600">{referral.notes}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 누가 소개해줬나 */}
      {activeSubTab === 'asReferred' && (
        <div className="space-y-3">
          {referralsAsReferred.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Icon icon={HiOutlineGift} size={48} className="mx-auto mb-3 text-gray-300" />
              <p>이 환자를 소개해준 기록이 없습니다.</p>
            </div>
          ) : (
            referralsAsReferred.map((referral) => (
              <div
                key={referral._id}
                className="border border-gray-200 rounded-lg p-4 bg-white"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <Icon icon={HiOutlineGift} size={24} className="text-green-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{referral.referrerName}</span>
                      <span className="text-sm text-gray-500">님이 소개</span>
                    </div>
                    <p className="text-sm text-gray-600">{referral.referrerPhone}</p>
                    <p className="text-xs text-gray-500">
                      소개일: {format(new Date(referral.referralDate), 'yyyy년 M월 d일', { locale: ko })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 소개 환자 등록 폼 (인라인) */}
      {showAddModal && (
        <div className="border-t pt-4 mt-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">소개 환자 등록</h4>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setSelectedPatientForReferral(null)
                  setSearchQuery('')
                  setSearchResults([])
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icon icon={HiOutlineX} size={18} />
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>{patient.name}</strong> 님이 소개해준 환자를 등록합니다.
              </p>
            </div>

            {/* 환자 검색 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                피소개자 (소개받은 환자) 검색
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="이름 또는 전화번호로 검색"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  <Icon icon={HiOutlineSearch} size={18} />
                </button>
              </div>
            </div>

            {/* 검색 결과 */}
            {searchResults.length > 0 && (
              <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto bg-white">
                {searchResults.map((p) => (
                  <button
                    key={p._id || p.id}
                    onClick={() => setSelectedPatientForReferral(p)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                      selectedPatientForReferral?._id === p._id || selectedPatientForReferral?.id === p.id
                        ? 'bg-primary/10'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{p.name}</span>
                        <span className="text-sm text-gray-500 ml-2">{p.phoneNumber}</span>
                      </div>
                      {(selectedPatientForReferral?._id === p._id || selectedPatientForReferral?.id === p.id) && (
                        <Icon icon={HiOutlineCheck} size={18} className="text-primary" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* 선택된 환자 */}
            {selectedPatientForReferral && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  선택된 환자: <strong>{selectedPatientForReferral.name}</strong> ({selectedPatientForReferral.phoneNumber})
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setSelectedPatientForReferral(null)
                  setSearchQuery('')
                  setSearchResults([])
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                취소
              </button>
              <button
                onClick={handleRegisterReferral}
                disabled={!selectedPatientForReferral}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                등록
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
