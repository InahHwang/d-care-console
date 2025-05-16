// src/components/campaigns/CampaignList.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks'
import { RootState } from '@/store'
import { 
  fetchCampaigns, 
  selectCampaign, 
  updateCampaignStatus,
  Campaign,
  CampaignStatus
} from '@/store/slices/campaignsSlice'
import { 
  HiOutlineCalendar, 
  HiOutlineChevronRight, 
  HiOutlineClipboardCheck,
  HiOutlineClock,
  HiOutlineDocumentText,
  HiOutlinePlay,
  HiOutlineStop,
  HiOutlineTrash,
  HiOutlineUsers,
  HiOutlineExclamation
} from 'react-icons/hi'
import { Icon } from '../common/Icon'
import { format, formatDistance } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import CampaignDetail from './CampaignDetail'

export default function CampaignList() {
  const dispatch = useAppDispatch()
  const { campaigns, currentCampaign, isLoading } = useAppSelector((state: RootState) => state.campaigns)
  
  // 캠페인 상태별 필터
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all')
  
  // 필터링된 캠페인 목록
  const [filteredCampaigns, setFilteredCampaigns] = useState<Campaign[]>([])
  
  // 상태 변경 확인 모달
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [campaignToUpdate, setCampaignToUpdate] = useState<Campaign | null>(null)
  const [newStatus, setNewStatus] = useState<CampaignStatus>('scheduled')
  
  // 캠페인 데이터 로드
  useEffect(() => {
    dispatch(fetchCampaigns())
  }, [dispatch])
  
  // 필터 적용
  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredCampaigns(campaigns)
    } else {
      setFilteredCampaigns(campaigns.filter(campaign => campaign.status === statusFilter))
    }
  }, [campaigns, statusFilter])
  
  // 캠페인 상세 보기
  const handleViewCampaign = (campaignId: string) => {
    dispatch(selectCampaign(campaignId))
  }
  
  // 상태 변경 모달 열기
  const handleOpenStatusModal = (campaign: Campaign, status: CampaignStatus) => {
    setCampaignToUpdate(campaign)
    setNewStatus(status)
    setIsStatusModalOpen(true)
  }
  
  // 상태 변경 처리
  const handleUpdateStatus = async () => {
    if (!campaignToUpdate) return
    
    try {
      await dispatch(updateCampaignStatus({
        campaignId: campaignToUpdate.id,
        status: newStatus
      })).unwrap()
      
      setIsStatusModalOpen(false)
      setCampaignToUpdate(null)
    } catch (error) {
      console.error('캠페인 상태 변경 오류:', error)
      alert('캠페인 상태 변경 중 오류가 발생했습니다.')
    }
  }
  
  // 캠페인 상태에 따른 배지 스타일
  const getStatusBadgeStyle = (status: CampaignStatus) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
  
  // 캠페인 상태 한글 표시
  const getStatusLabel = (status: CampaignStatus) => {
    const statusMap: Record<CampaignStatus, string> = {
      draft: '임시 저장',
      scheduled: '예약됨',
      in_progress: '진행 중',
      completed: '완료됨',
      cancelled: '취소됨'
    };
    
    return statusMap[status] || status;
  }
  
  // 날짜 포맷 및 경과 시간 계산
  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    
    try {
      const date = new Date(dateStr);
      return format(date, 'yyyy-MM-dd HH:mm');
    } catch (e) {
      return dateStr;
    }
  }
  
  const getTimeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    
    try {
      return formatDistance(new Date(dateStr), new Date(), { addSuffix: true, locale: ko });
    } catch (e) {
      return '';
    }
  }
  
  return (
    <div>
      {/* 페이지 제목 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">캠페인 관리</h1>
        <button
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2"
          onClick={() => handleViewCampaign('new')} // 새 캠페인 생성 뷰로 이동
        >
          <Icon icon={HiOutlineDocumentText} size={18} />
          <span>새 캠페인</span>
        </button>
      </div>
      
      {/* 필터 영역 */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          className={`px-4 py-2 rounded-full text-sm flex items-center gap-1 transition-colors ${
            statusFilter === 'all'
              ? 'bg-primary text-white'
              : 'bg-light-bg text-text-secondary hover:bg-gray-200'
          }`}
          onClick={() => setStatusFilter('all')}
        >
          전체
        </button>
        <button
          className={`px-4 py-2 rounded-full text-sm flex items-center gap-1 transition-colors ${
            statusFilter === 'draft'
              ? 'bg-primary text-white'
              : 'bg-light-bg text-text-secondary hover:bg-gray-200'
          }`}
          onClick={() => setStatusFilter('draft')}
        >
          임시 저장
        </button>
        <button
          className={`px-4 py-2 rounded-full text-sm flex items-center gap-1 transition-colors ${
            statusFilter === 'scheduled'
              ? 'bg-primary text-white'
              : 'bg-light-bg text-text-secondary hover:bg-gray-200'
          }`}
          onClick={() => setStatusFilter('scheduled')}
        >
          예약됨
        </button>
        <button
          className={`px-4 py-2 rounded-full text-sm flex items-center gap-1 transition-colors ${
            statusFilter === 'in_progress'
              ? 'bg-primary text-white'
              : 'bg-light-bg text-text-secondary hover:bg-gray-200'
          }`}
          onClick={() => setStatusFilter('in_progress')}
        >
          진행 중
        </button>
        <button
          className={`px-4 py-2 rounded-full text-sm flex items-center gap-1 transition-colors ${
            statusFilter === 'completed'
              ? 'bg-primary text-white'
              : 'bg-light-bg text-text-secondary hover:bg-gray-200'
          }`}
          onClick={() => setStatusFilter('completed')}
        >
          완료됨
        </button>
        <button
          className={`px-4 py-2 rounded-full text-sm flex items-center gap-1 transition-colors ${
            statusFilter === 'cancelled'
              ? 'bg-primary text-white'
              : 'bg-light-bg text-text-secondary hover:bg-gray-200'
          }`}
          onClick={() => setStatusFilter('cancelled')}
        >
          취소됨
        </button>
      </div>
      
      {/* 캠페인 목록 */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="card p-6 text-center text-text-secondary">
            캠페인 정보를 불러오는 중...
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="card p-6 text-center text-text-secondary">
            {statusFilter === 'all' 
              ? '등록된 캠페인이 없습니다.' 
              : `'${getStatusLabel(statusFilter)}' 상태인 캠페인이 없습니다.`}
          </div>
        ) : (
          filteredCampaigns.map(campaign => (
            <div 
              key={campaign.id} 
              className="card p-0 overflow-hidden"
            >
              <div className="p-5 border-b border-border cursor-pointer hover:bg-light-bg/30 transition-colors" onClick={() => handleViewCampaign(campaign.id)}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-medium text-text-primary truncate">{campaign.name}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeStyle(campaign.status)}`}>
                        {getStatusLabel(campaign.status)}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-secondary mt-2">
                      <div className="flex items-center gap-1">
                        <Icon icon={HiOutlineCalendar} size={16} />
                        <span>생성: {formatDateTime(campaign.createdAt)}</span>
                      </div>
                      
                      {campaign.scheduledAt && (
                        <div className="flex items-center gap-1">
                          <Icon icon={HiOutlineClock} size={16} />
                          <span>예약: {formatDateTime(campaign.scheduledAt)}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-1">
                        <Icon icon={HiOutlineUsers} size={16} />
                        <span>대상자: {campaign.targetCount}명</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 text-sm text-text-secondary mt-2">
                      <Icon icon={HiOutlineDocumentText} size={16} />
                      <span>메시지: {campaign.message.title}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* 상태별 액션 버튼 */}
                    {campaign.status === 'draft' && (
                      <button
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded flex items-center gap-1 hover:bg-blue-200 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenStatusModal(campaign, 'scheduled');
                        }}
                      >
                        <Icon icon={HiOutlineCalendar} size={14} />
                        <span className="text-xs">예약</span>
                      </button>
                    )}
                    
                    {campaign.status === 'scheduled' && (
                      <>
                        <button
                          className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded flex items-center gap-1 hover:bg-yellow-200 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenStatusModal(campaign, 'in_progress');
                          }}
                        >
                          <Icon icon={HiOutlinePlay} size={14} />
                          <span className="text-xs">시작</span>
                        </button>
                        <button
                          className="px-3 py-1 bg-red-100 text-red-800 rounded flex items-center gap-1 hover:bg-red-200 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenStatusModal(campaign, 'cancelled');
                          }}
                        >
                          <Icon icon={HiOutlineStop} size={14} />
                          <span className="text-xs">취소</span>
                        </button>
                      </>
                    )}
                    
                    {campaign.status === 'in_progress' && (
                      <button
                        className="px-3 py-1 bg-green-100 text-green-800 rounded flex items-center gap-1 hover:bg-green-200 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenStatusModal(campaign, 'completed');
                        }}
                      >
                        <Icon icon={HiOutlineClipboardCheck} size={14} />
                        <span className="text-xs">완료</span>
                      </button>
                    )}
                    
                    <button className="p-1 text-text-secondary hover:text-primary">
                      <Icon icon={HiOutlineChevronRight} size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* 캠페인 상세 정보/생성 모달 */}
      {currentCampaign && <CampaignDetail />}
      
      {/* 상태 변경 확인 모달 */}
      {isStatusModalOpen && campaignToUpdate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">캠페인 상태 변경</h3>
              <button
                className="text-text-secondary hover:text-text-primary"
                onClick={() => {
                  setIsStatusModalOpen(false)
                  setCampaignToUpdate(null)
                }}
              >
                <Icon icon={HiOutlineStop} size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center gap-3 p-4 bg-light-bg rounded-md mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Icon icon={HiOutlineDocumentText} size={20} />
                  </div>
                  <div>
                    <div className="text-text-primary font-medium">
                      {campaignToUpdate.name}
                    </div>
                    <div className="text-sm text-text-secondary">
                      상태: {getStatusLabel(campaignToUpdate.status)} → {getStatusLabel(newStatus)}
                    </div>
                  </div>
                </div>
                
                {newStatus === 'cancelled' && (
                  <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md text-red-800 mb-4">
                    <Icon icon={HiOutlineExclamation} size={18} />
                    <span>캠페인을 취소하면 예약된 메시지가 발송되지 않습니다.</span>
                  </div>
                )}
                
                {newStatus === 'in_progress' && (
                  <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 mb-4">
                    <Icon icon={HiOutlineExclamation} size={18} />
                    <span>캠페인을 시작하면 대상 환자들에게 메시지가 발송됩니다.</span>
                  </div>
                )}
                
                <p className="text-text-secondary">
                  {newStatus === 'scheduled' && '이 캠페인을 예약 상태로 변경하시겠습니까?'}
                  {newStatus === 'in_progress' && '이 캠페인을 지금 바로 시작하시겠습니까?'}
                  {newStatus === 'completed' && '이 캠페인을 완료 처리하시겠습니까?'}
                  {newStatus === 'cancelled' && '이 캠페인을 취소하시겠습니까?'}
                </p>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setIsStatusModalOpen(false)
                    setCampaignToUpdate(null)
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  className={`btn ${
                    newStatus === 'cancelled' ? 'bg-red-600 hover:bg-red-700' : 
                    newStatus === 'completed' ? 'bg-green-600 hover:bg-green-700' :
                    'bg-primary hover:bg-primary/90'
                  } text-white`}
                  onClick={handleUpdateStatus}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}