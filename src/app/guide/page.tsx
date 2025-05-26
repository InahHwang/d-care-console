// src/app/guide/page.tsx
'use client'

import { useState } from 'react'
import { HiOutlineHome, HiOutlineChevronRight, HiOutlinePrinter, HiOutlineDownload } from 'react-icons/hi'
import { Icon } from '@/components/common/Icon'
import Link from 'next/link'

export default function GuidePage() {
  const [activeSection, setActiveSection] = useState('')

  const tableOfContents = [
    { id: 'getting-started', title: '시작하기', icon: '🚀' },
    { id: 'dashboard', title: '대시보드 활용법', icon: '📊' },
    { id: 'patient-management', title: '환자 관리', icon: '👥' },
    { id: 'callback-management', title: '콜백 관리', icon: '📞' },
    { id: 'message-management', title: '메시지 관리', icon: '💬' },
    { id: 'goals-statistics', title: '목표 설정 및 통계', icon: '🎯' },
    { id: 'faq', title: '자주 묻는 질문', icon: '❓' },
  ]

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    // PDF 다운로드 로직 (추후 구현)
    alert('PDF 다운로드 기능은 준비 중입니다.')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* 브레드크럼 */}
            <nav className="flex items-center gap-2 text-sm">
              <Link href="/" className="flex items-center gap-1 text-primary hover:text-primary-dark">
                <Icon icon={HiOutlineHome} size={16} />
                대시보드
              </Link>
              <Icon icon={HiOutlineChevronRight} size={14} className="text-text-muted" />
              <span className="text-text-primary font-medium">사용 가이드</span>
            </nav>

            {/* 액션 버튼들 */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Icon icon={HiOutlinePrinter} size={16} />
                인쇄
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-white hover:bg-primary-dark rounded-lg transition-colors"
              >
                <Icon icon={HiOutlineDownload} size={16} />
                PDF 다운로드
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* 사이드바 - 목차 */}
          <div className="w-64 flex-shrink-0">
            <div className="sticky top-8">
              <div className="bg-white rounded-lg border border-border p-4">
                <h3 className="font-semibold text-text-primary mb-4">목차</h3>
                <nav className="space-y-2">
                  {tableOfContents.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                        activeSection === item.id
                          ? 'bg-primary text-white'
                          : 'text-text-secondary hover:text-text-primary hover:bg-gray-100'
                      }`}
                      onClick={() => setActiveSection(item.id)}
                    >
                      <span>{item.icon}</span>
                      {item.title}
                    </a>
                  ))}
                </nav>
              </div>
            </div>
          </div>

          {/* 메인 콘텐츠 */}
          <div className="flex-1">
            <div className="bg-white rounded-lg border border-border">
              <div className="p-8">
                <div className="prose prose-slate max-w-none">
                  {/* 가이드 제목 */}
                  <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-text-primary mb-2">
                      치과 아웃바운드 콜 상담 시스템
                    </h1>
                    <h2 className="text-xl text-text-secondary">사용 가이드</h2>
                    <div className="mt-4 text-sm text-text-muted">
                      마지막 업데이트: 2025년 5월 26일 | 버전: v2.1.0
                    </div>
                  </div>

                  {/* 시작하기 */}
                  <section id="getting-started" className="mb-12">
                    <h2 className="text-2xl font-bold text-text-primary mb-4 flex items-center gap-2">
                      🚀 시작하기
                    </h2>
                    
                    <h3 className="text-lg font-semibold text-text-primary mb-3">첫 로그인 후 해야할 일</h3>
                    <ol className="list-decimal list-inside space-y-2 mb-6">
                      <li><strong>목표 설정</strong>: 우측 상단 ⚙️ 설정 → 목표 설정에서 월간 목표 입력</li>
                      <li><strong>메시지 템플릿</strong>: 자주 사용하는 상담 문구를 미리 저장</li>
                      <li><strong>환자 데이터</strong>: 기존 환자 정보가 있다면 일괄 업로드</li>
                    </ol>

                    <h3 className="text-lg font-semibold text-text-primary mb-3">기본 화면 구성</h3>
                    <ul className="list-disc list-inside space-y-2">
                      <li><strong>좌측 사이드바</strong>: 주요 메뉴 (대시보드, 환자관리, 통계, 설정)</li>
                      <li><strong>상단 헤더</strong>: 검색, 퀵액션, 설정, 도움말</li>
                      <li><strong>메인 영역</strong>: 선택한 메뉴의 상세 내용</li>
                    </ul>
                  </section>

                  {/* 대시보드 활용법 */}
                  <section id="dashboard" className="mb-12">
                    <h2 className="text-2xl font-bold text-text-primary mb-4 flex items-center gap-2">
                      📊 대시보드 활용법
                    </h2>
                    
                    <h3 className="text-lg font-semibold text-text-primary mb-3">실시간 현황 카드</h3>
                    <ul className="list-disc list-inside space-y-2 mb-6">
                      <li><strong>콜백 필요</strong>: 즉시 연락해야 할 환자 수</li>
                      <li><strong>부재중</strong>: 연락이 닿지 않은 환자 수</li>
                      <li><strong>오늘 예정된 콜</strong>: 오늘 스케줄된 콜백 업무량</li>
                      <li><strong>이번달 신규 환자</strong>: 월간 신규 환자 현황</li>
                    </ul>

                    <h3 className="text-lg font-semibold text-text-primary mb-3">목표 달성률 확인</h3>
                    <ul className="list-disc list-inside space-y-2 mb-6">
                      <li><strong>신규 환자 목표</strong>: 이번 달 목표 대비 달성률</li>
                      <li><strong>예약 목표</strong>: 예약 전환 목표 대비 달성률</li>
                      <li>목표 수정은 우측 "목표 수정" 버튼 클릭</li>
                    </ul>

                    <h3 className="text-lg font-semibold text-text-primary mb-3">성과 지표 분석</h3>
                    <ul className="list-disc list-inside space-y-2">
                      <li><strong>아웃바운드 콜 수</strong>: 이번 달 발신 콜 통계</li>
                      <li><strong>예약 전환율</strong>: 콜 → 예약 전환 비율</li>
                      <li><strong>내원 전환율</strong>: 예약 → 실제 내원 비율</li>
                    </ul>
                  </section>

                  {/* 환자 관리 */}
                  <section id="patient-management" className="mb-12">
                    <h2 className="text-2xl font-bold text-text-primary mb-4 flex items-center gap-2">
                      👥 환자 관리
                    </h2>
                    
                    <h3 className="text-lg font-semibold text-text-primary mb-3">신규 환자 등록</h3>
                    <ol className="list-decimal list-inside space-y-2 mb-6">
                      <li><strong>퀵액션</strong> (우측 상단 + 버튼) → "신규 환자 등록" 클릭</li>
                      <li>필수 정보 입력:
                        <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                          <li>이름, 연락처 (필수)</li>
                          <li>상담 내용, 관심 치료 항목</li>
                          <li>거주 지역, 선호 시간대</li>
                        </ul>
                      </li>
                      <li><strong>저장</strong> 클릭으로 등록 완료</li>
                    </ol>

                    <h3 className="text-lg font-semibold text-text-primary mb-3">환자 상태 관리</h3>
                    <ul className="list-disc list-inside space-y-2">
                      <li><strong>상담중</strong>: 초기 상담 진행 중</li>
                      <li><strong>콜백 대기</strong>: 재연락 예정</li>
                      <li><strong>예약확정</strong>: 병원 방문 예약 완료</li>
                      <li><strong>부재중</strong>: 연락 불가 상태</li>
                      <li><strong>상담완료</strong>: 상담 종료</li>
                      <li><strong>취소</strong>: 상담 포기</li>
                    </ul>
                  </section>

                  {/* 콜백 관리 */}
                  <section id="callback-management" className="mb-12">
                    <h2 className="text-2xl font-bold text-text-primary mb-4 flex items-center gap-2">
                      📞 콜백 관리
                    </h2>
                    
                    <h3 className="text-lg font-semibold text-text-primary mb-3">콜백 스케줄 등록</h3>
                    <ol className="list-decimal list-inside space-y-2 mb-6">
                      <li><strong>퀵액션</strong> → "콜백 스케줄 등록" 클릭</li>
                      <li>환자 선택 (기존 환자 또는 새 환자)</li>
                      <li>콜백 일시 및 메모 입력</li>
                      <li><strong>저장</strong>으로 스케줄 등록</li>
                    </ol>

                    <h3 className="text-lg font-semibold text-text-primary mb-3">콜백 실행 및 결과 기록</h3>
                    <ol className="list-decimal list-inside space-y-2">
                      <li><strong>오늘의 콜백</strong> 리스트에서 환자 선택</li>
                      <li><strong>콜 시작</strong> 버튼으로 상담 시작</li>
                      <li>상담 내용 및 결과 기록:
                        <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                          <li><strong>성공</strong>: 예약 확정, 재상담 예정 등</li>
                          <li><strong>부재중</strong>: 재시도 일정 설정</li>
                          <li><strong>거절</strong>: 상담 종료 처리</li>
                        </ul>
                      </li>
                    </ol>
                  </section>

                  {/* 메시지 관리 */}
                  <section id="message-management" className="mb-12">
                    <h2 className="text-2xl font-bold text-text-primary mb-4 flex items-center gap-2">
                      💬 메시지 관리
                    </h2>
                    
                    <h3 className="text-lg font-semibold text-text-primary mb-3">메시지 템플릿 활용</h3>
                    <ol className="list-decimal list-inside space-y-2 mb-6">
                      <li><strong>설정</strong> → <strong>메시지 템플릿</strong> 에서 템플릿 관리</li>
                      <li>자주 사용하는 문구 미리 저장:
                        <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                          <li>초기 상담 안내 문구</li>
                          <li>예약 확정 안내 문구</li>
                          <li>리마인더 문구</li>
                          <li>감사 인사 문구</li>
                        </ul>
                      </li>
                    </ol>

                    <h3 className="text-lg font-semibold text-text-primary mb-3">메시지 전송</h3>
                    <ol className="list-decimal list-inside space-y-2">
                      <li><strong>퀵액션</strong> → "메시지 전송" 클릭</li>
                      <li>수신자 선택 (개별 또는 그룹)</li>
                      <li>템플릿 선택하거나 직접 작성</li>
                      <li><strong>전송</strong> 버튼으로 발송</li>
                    </ol>
                  </section>

                  {/* 목표 설정 및 통계 */}
                  <section id="goals-statistics" className="mb-12">
                    <h2 className="text-2xl font-bold text-text-primary mb-4 flex items-center gap-2">
                      🎯 목표 설정 및 통계
                    </h2>
                    
                    <h3 className="text-lg font-semibold text-text-primary mb-3">월간 목표 설정</h3>
                    <ol className="list-decimal list-inside space-y-2 mb-6">
                      <li><strong>설정</strong> → <strong>목표 설정</strong> 메뉴</li>
                      <li>신규 환자 목표 수 입력</li>
                      <li>예약 목표 건수 입력</li>
                      <li><strong>저장</strong>으로 목표 설정 완료</li>
                    </ol>

                    <h3 className="text-lg font-semibold text-text-primary mb-3">리포트 생성</h3>
                    <ol className="list-decimal list-inside space-y-2">
                      <li><strong>퀵액션</strong> → "퀵 리포트 생성"</li>
                      <li>기간 및 항목 선택</li>
                      <li><strong>생성</strong> 버튼으로 리포트 다운로드</li>
                    </ol>
                  </section>

                  {/* 자주 묻는 질문 */}
                  <section id="faq" className="mb-12">
                    <h2 className="text-2xl font-bold text-text-primary mb-4 flex items-center gap-2">
                      ❓ 자주 묻는 질문
                    </h2>
                    
                    <div className="space-y-6">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-semibold text-text-primary mb-2">Q: 환자 정보를 실수로 삭제했어요</h3>
                        <p className="text-text-secondary"><strong>A</strong>: 삭제된 환자는 휴지통에서 30일간 보관됩니다. 설정 → 데이터 관리 → 휴지통에서 복원하세요.</p>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-semibold text-text-primary mb-2">Q: 콜백 일정을 놓쳤어요</h3>
                        <p className="text-text-secondary"><strong>A</strong>: 대시보드에서 "오늘 예정된 콜" 카드를 확인하세요. 지난 콜백은 자동으로 "연기" 상태로 변경됩니다.</p>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-semibold text-text-primary mb-2">Q: 목표 달성률이 정확하지 않아요</h3>
                        <p className="text-text-secondary"><strong>A</strong>: 환자 상태가 정확히 업데이트되었는지 확인하세요. 예약확정/내원확정 상태로 변경해야 목표에 반영됩니다.</p>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-semibold text-text-primary mb-2">Q: 메시지가 발송되지 않아요</h3>
                        <p className="text-text-secondary"><strong>A</strong>: 연락처 형식을 확인하세요. 휴대폰 번호는 010-0000-0000 형식으로 입력해야 합니다.</p>
                      </div>
                    </div>
                  </section>

                  {/* 지원 문의 */}
                  <section className="bg-blue-50 p-6 rounded-lg">
                    <h2 className="text-xl font-bold text-text-primary mb-4">📞 지원 문의</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <strong>기술 지원</strong><br />
                        support@dental-care.com
                      </div>
                      <div>
                        <strong>사용 문의</strong><br />
                        help@dental-care.com
                      </div>
                      <div>
                        <strong>전화 상담</strong><br />
                        1588-0000 (평일 9시-18시)
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}