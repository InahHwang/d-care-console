// src/app/v2/reports/test-monthly/page.tsx
// 풀 데이터 테스트용 월보고서 미리보기 페이지
// 실제 DB 데이터 없이 로컬 mock 데이터로 렌더링
'use client';

import React, { useState } from 'react';
import MonthlyReportFullView from '../components/MonthlyReport-FullView';
import type { MonthlyReportV2, MonthlyStatsV2, PatientSummaryV2 } from '../components/MonthlyReport-Types';

// ─────────────────────────────────────────
// 환자 목록 mock (20명)
// ─────────────────────────────────────────
const mockPatients: PatientSummaryV2[] = [
  {
    patientId: 'p001', name: '김서연', phone: '010-1234-5678', age: 34, gender: '여',
    interest: '임플란트', status: 'completed', statusLabel: '치료완료',
    consultationSummary: '상악 좌측 임플란트 2본 진행, 치료 완료',
    fullConsultation: '상악 좌측 #26, #27 임플란트 2본 식립. 골이식 동반. 4개월 치유기간 후 보철 완료.',
    estimatedAmount: 6000000, finalAmount: 5400000,
    hasPhoneConsultation: true, hasVisitConsultation: true,
    consultationType: 'inbound', createdAt: '2026-01-03',
  },
  {
    patientId: 'p002', name: '이준호', phone: '010-2345-6789', age: 45, gender: '남',
    interest: '치아교정', status: 'treatment', statusLabel: '치료중',
    consultationSummary: '투명교정 진행 중, 3단계 완료',
    fullConsultation: '인비절라인 투명교정 시작. 총 14단계 중 3단계 완료. 2주 간격 방문.',
    estimatedAmount: 5500000, finalAmount: 5000000,
    hasPhoneConsultation: true, hasVisitConsultation: true,
    consultationType: 'outbound', createdAt: '2026-01-05',
  },
  {
    patientId: 'p003', name: '박민지', phone: '010-3456-7890', age: 28, gender: '여',
    interest: '라미네이트', status: 'visited', statusLabel: '내원완료',
    consultationSummary: '상악 전치 6본 라미네이트 상담, 비용 고민 중',
    fullConsultation: '상악 전치부 6본 라미네이트 희망. 색상 A1 선호. 비용 부담 느끼고 있어 할부 안내.',
    estimatedAmount: 4200000, finalAmount: 0,
    hasPhoneConsultation: true, hasVisitConsultation: true,
    consultationType: 'inbound', createdAt: '2026-01-07',
  },
  {
    patientId: 'p004', name: '최영수', phone: '010-4567-8901', age: 52, gender: '남',
    interest: '임플란트', status: 'completed', statusLabel: '치료완료',
    consultationSummary: '하악 임플란트 3본 + 브릿지, 완료',
    fullConsultation: '하악 좌측 #35, #36, #37 임플란트 3본 식립 완료. 오스템 TS III 사용.',
    estimatedAmount: 9000000, finalAmount: 8100000,
    hasPhoneConsultation: true, hasVisitConsultation: true,
    consultationType: 'outbound', createdAt: '2026-01-02',
  },
  {
    patientId: 'p005', name: '정하윤', phone: '010-5678-9012', age: 31, gender: '여',
    interest: '치아미백', status: 'treatmentBooked', statusLabel: '치료예약',
    consultationSummary: '전문가 미백 + 자가 미백 예약 완료',
    fullConsultation: '전문가 미백 2회 + 자가미백 키트 패키지 상담. 1월 15일 첫 시술 예약.',
    estimatedAmount: 800000, finalAmount: 700000,
    hasPhoneConsultation: true, hasVisitConsultation: true,
    consultationType: 'inbound', createdAt: '2026-01-08',
  },
  {
    patientId: 'p006', name: '강도현', phone: '010-6789-0123', age: 39, gender: '남',
    interest: '충치치료', status: 'treatment', statusLabel: '치료중',
    consultationSummary: '다발성 충치 치료 진행 중 (5개)',
    fullConsultation: '다발성 충치 5개 발견. #15 크라운, #24, #25 레진, #36 인레이, #46 레진 진행 중.',
    estimatedAmount: 2500000, finalAmount: 2200000,
    hasPhoneConsultation: true, hasVisitConsultation: true,
    consultationType: 'returning', createdAt: '2026-01-10',
  },
  {
    patientId: 'p007', name: '윤서아', phone: '010-7890-1234', age: 26, gender: '여',
    interest: '치아교정', status: 'reserved', statusLabel: '예약완료',
    consultationSummary: '교정 상담 예약, 세라믹 vs 투명 고민',
    fullConsultation: '상하악 교정 희망. 세라믹 교정과 투명교정 사이에서 고민 중. 1월 20일 내원 예약.',
    estimatedAmount: 4500000, finalAmount: 0,
    hasPhoneConsultation: true, hasVisitConsultation: false,
    consultationType: 'inbound', createdAt: '2026-01-11',
    hasActiveCallback: true, nextCallbackDate: '2026-01-20', nextCallbackNote: '내원 예약 확인 전화',
  },
  {
    patientId: 'p008', name: '송태민', phone: '010-8901-2345', age: 58, gender: '남',
    interest: '임플란트', status: 'closed', statusLabel: '종결',
    consultationSummary: '전악 임플란트 상담 후 비용 문제로 종결',
    fullConsultation: '전악 임플란트 상담. 상악 6본, 하악 4본 필요. 총 견적 3천만원에 부담 느끼고 타원 비교 중.',
    estimatedAmount: 30000000, finalAmount: 0,
    hasPhoneConsultation: true, hasVisitConsultation: true,
    consultationType: 'inbound', createdAt: '2026-01-04',
    hasActiveCallback: false,
  },
  {
    patientId: 'p009', name: '한지우', phone: '010-9012-3456', age: 33, gender: '여',
    interest: '스케일링', status: 'completed', statusLabel: '치료완료',
    consultationSummary: '스케일링 + 잇몸치료 완료',
    fullConsultation: '전악 스케일링 및 치은연하 소파술 시행. 6개월 후 재방문 안내.',
    estimatedAmount: 150000, finalAmount: 150000,
    hasPhoneConsultation: false, hasVisitConsultation: true,
    consultationType: 'returning', createdAt: '2026-01-12',
  },
  {
    patientId: 'p010', name: '오승현', phone: '010-0123-4567', age: 41, gender: '남',
    interest: '임플란트', status: 'visited', statusLabel: '내원완료',
    consultationSummary: '임플란트 1본 상담, 검토 중',
    fullConsultation: '#46 임플란트 1본 상담. CT 촬영 완료. 골양 충분. 비용 및 일정 검토 중.',
    estimatedAmount: 2000000, finalAmount: 0,
    hasPhoneConsultation: true, hasVisitConsultation: true,
    consultationType: 'outbound', createdAt: '2026-01-06',
    hasActiveCallback: false, // ← 내원 후 방치 (high)
  },
  {
    patientId: 'p011', name: '임예진', phone: '010-1111-2222', age: 29, gender: '여',
    interest: '라미네이트', status: 'treatment', statusLabel: '치료중',
    consultationSummary: '상악 전치 4본 라미네이트 진행',
    fullConsultation: '상악 전치 4본 포셀린 라미네이트. 임시 라미네이트 장착 후 최종 제작 중.',
    estimatedAmount: 3200000, finalAmount: 3000000,
    hasPhoneConsultation: true, hasVisitConsultation: true,
    consultationType: 'inbound', createdAt: '2026-01-09',
  },
  {
    patientId: 'p012', name: '장민수', phone: '010-2222-3333', age: 47, gender: '남',
    interest: '충치치료', status: 'closed', statusLabel: '종결',
    consultationSummary: '충치 치료 상담 후 연락 두절',
    fullConsultation: '#15, #16 크라운 치료 필요. 2회 통화 후 연락 두절.',
    estimatedAmount: 1200000, finalAmount: 0,
    hasPhoneConsultation: true, hasVisitConsultation: false,
    consultationType: 'outbound', createdAt: '2026-01-13',
  },
  {
    patientId: 'p013', name: '배수지', phone: '010-3333-4444', age: 36, gender: '여',
    interest: '치아교정', status: 'completed', statusLabel: '치료완료',
    consultationSummary: '부분교정 완료, 유지장치 장착',
    fullConsultation: '하악 전치부 부분교정 6개월 과정 완료. 고정식 유지장치 부착.',
    estimatedAmount: 2500000, finalAmount: 2300000,
    hasPhoneConsultation: true, hasVisitConsultation: true,
    consultationType: 'inbound', createdAt: '2026-01-01',
  },
  {
    patientId: 'p014', name: '노진우', phone: '010-4444-5555', age: 55, gender: '남',
    interest: '임플란트', status: 'followup', statusLabel: '사후관리',
    consultationSummary: '임플란트 2본 완료, 정기검진 중',
    fullConsultation: '#36, #37 임플란트 2본 완료. 3개월 단위 정기검진 진행.',
    estimatedAmount: 5000000, finalAmount: 4500000,
    hasPhoneConsultation: true, hasVisitConsultation: true,
    consultationType: 'returning', createdAt: '2026-01-02',
  },
  {
    patientId: 'p015', name: '유하은', phone: '010-5555-6666', age: 24, gender: '여',
    interest: '치아미백', status: 'consulting', statusLabel: '전화상담',
    consultationSummary: '미백 상담 중, 가격 비교',
    fullConsultation: '전문가 미백 상담. 타원 가격 비교 중. 추가 연락 예정.',
    estimatedAmount: 500000, finalAmount: 0,
    hasPhoneConsultation: true, hasVisitConsultation: false,
    consultationType: 'inbound', createdAt: '2026-01-14',
  },
  {
    patientId: 'p016', name: '신동혁', phone: '010-6666-7777', age: 43, gender: '남',
    interest: '크라운', status: 'treatment', statusLabel: '치료중',
    consultationSummary: '지르코니아 크라운 3본 치료 중',
    fullConsultation: '#15, #25, #46 지르코니아 크라운 3본. 임시 크라운 장착 완료, 최종 보철 제작 중.',
    estimatedAmount: 2100000, finalAmount: 1900000,
    hasPhoneConsultation: true, hasVisitConsultation: true,
    consultationType: 'outbound', createdAt: '2026-01-08',
  },
  {
    patientId: 'p017', name: '권지현', phone: '010-7777-8888', age: 37, gender: '여',
    interest: '임플란트', status: 'reserved', statusLabel: '예약완료',
    consultationSummary: '임플란트 상담 예약 (1/25), 미내원',
    fullConsultation: '#36 임플란트 1본 희망. 파노라마 촬영 위해 1월 25일 내원 예약했으나 미내원.',
    estimatedAmount: 2000000, finalAmount: 0,
    hasPhoneConsultation: true, hasVisitConsultation: false,
    consultationType: 'inbound', createdAt: '2026-01-15',
    hasActiveCallback: true, nextCallbackDate: '2026-01-25', nextCallbackNote: '1/25 예약했으나 미내원', // ← 예약일 경과 (과거 날짜)
  },
  {
    patientId: 'p018', name: '조현우', phone: '010-8888-9999', age: 50, gender: '남',
    interest: '충치치료', status: 'closed', statusLabel: '종결',
    consultationSummary: '거리 멀어서 타원 방문 결정',
    fullConsultation: '다발성 충치 + 크라운 상담. 경기도 거주로 거리 문제 있어 거주지 인근 치과 방문 결정.',
    estimatedAmount: 2800000, finalAmount: 0,
    hasPhoneConsultation: true, hasVisitConsultation: false,
    consultationType: 'outbound', createdAt: '2026-01-06',
    hasActiveCallback: false, // ← 놓친 매출 medium (200만~500만)
  },
  {
    patientId: 'p019', name: '황미래', phone: '010-9999-0000', age: 32, gender: '여',
    interest: '스케일링', status: 'completed', statusLabel: '치료완료',
    consultationSummary: '스케일링 완료',
    fullConsultation: '정기 스케일링 시행. 특이사항 없음.',
    estimatedAmount: 80000, finalAmount: 80000,
    hasPhoneConsultation: false, hasVisitConsultation: true,
    consultationType: 'returning', createdAt: '2026-01-10',
  },
  {
    patientId: 'p020', name: '문재현', phone: '010-0000-1111', age: 62, gender: '남',
    interest: '틀니', status: 'visited', statusLabel: '내원완료',
    consultationSummary: '상악 부분틀니 상담, 임플란트와 비교 중',
    fullConsultation: '상악 부분틀니 vs 임플란트 상담. 비용 차이 크게 느끼고 고민 중. 자녀와 상의 예정.',
    estimatedAmount: 3000000, finalAmount: 0,
    hasPhoneConsultation: true, hasVisitConsultation: true,
    consultationType: 'inbound', createdAt: '2026-01-11',
    hasActiveCallback: false, // ← 내원 후 방치 (high)
  },
  // ── 상담 방치 / 상담 정체 테스트 환자 ──
  {
    patientId: 'p021', name: '이승환', phone: '010-1212-3434', age: 48, gender: '남',
    interest: '임플란트', status: 'consulting', statusLabel: '전화상담',
    consultationSummary: '하악 임플란트 2본 상담, 이후 연락 없음',
    fullConsultation: '하악 #36, #37 임플란트 2본 상담. 견적 안내 후 추가 연락 없는 상태.',
    estimatedAmount: 4000000, finalAmount: 0,
    hasPhoneConsultation: true, hasVisitConsultation: false,
    consultationType: 'inbound', createdAt: '2026-01-05',
    hasActiveCallback: false, // ← 상담 방치 (high) — 콜백도 없이 방치
  },
  {
    patientId: 'p022', name: '김나영', phone: '010-5656-7878', age: 35, gender: '여',
    interest: '치아교정', status: 'consulting', statusLabel: '전화상담',
    consultationSummary: '교정 상담 후 콜백 예정',
    fullConsultation: '상하악 투명교정 상담. 비용 고민 중이나 관심 높음. 2/20 콜백 예정.',
    estimatedAmount: 5000000, finalAmount: 0,
    hasPhoneConsultation: true, hasVisitConsultation: false,
    consultationType: 'inbound', createdAt: '2026-01-12',
    hasActiveCallback: true, nextCallbackDate: '2026-02-20', nextCallbackNote: '교정 비용 재상담', // ← 상담 정체 (medium) — 콜백은 있음
  },
];

// ─────────────────────────────────────────
// 일별 추이 데이터 (1월 한달, 31일)
// ─────────────────────────────────────────
function generateDailyTrends() {
  const trends = [];
  for (let d = 1; d <= 31; d++) {
    const day = String(d).padStart(2, '0');
    const isWeekend = new Date(2026, 0, d).getDay() === 0 || new Date(2026, 0, d).getDay() === 6;
    const base = isWeekend ? 2 : Math.floor(Math.random() * 5) + 6;
    trends.push({
      date: `2026-01-${day}`,
      calls: base,
      newPatients: Math.max(1, Math.floor(base * 0.6)),
      agreed: Math.max(0, Math.floor(base * 0.25)),
      revenue: Math.floor(Math.random() * 3000000) + 500000,
    });
  }
  return trends;
}

// ─────────────────────────────────────────
// 풀 통계 데이터
// ─────────────────────────────────────────
const mockStats: MonthlyStatsV2 = {
  // 상담 실적 요약
  totalInquiries: 156,
  inquiryBreakdown: { inbound: 82, outbound: 48, returning: 26 },

  // KPI
  reservedPatients: 98,
  reservedRate: 62.8,
  visitedPatients: 74,
  visitedRate: 47.4,
  agreedRevenue: 87500000,
  agreedPatients: 42,
  agreedRate: 26.9,

  // 전월 대비
  changes: {
    totalInquiries: { value: 18, type: 'increase' },
    inbound: { value: 12, type: 'increase' },
    outbound: { value: 3, type: 'decrease' },
    returning: { value: 9, type: 'increase' },
    reservedPatients: { value: 8, type: 'increase' },
    reservedRate: { value: 2.3, type: 'increase' },
    visitedPatients: { value: 5, type: 'increase' },
    visitedRate: { value: 1.1, type: 'decrease' },
    agreedRevenue: { value: 12500000, type: 'increase' },
    agreedPatients: { value: 4, type: 'increase' },
    agreedRate: { value: 0.8, type: 'decrease' },
  },

  // 환자 통계
  averageAge: 39.2,
  regionStats: [
    { region: '서울 강남구', count: 42, percentage: 26.9 },
    { region: '서울 서초구', count: 28, percentage: 17.9 },
    { region: '서울 송파구', count: 19, percentage: 12.2 },
    { region: '경기 성남시', count: 15, percentage: 9.6 },
    { region: '서울 강동구', count: 12, percentage: 7.7 },
    { region: '서울 마포구', count: 10, percentage: 6.4 },
    { region: '경기 용인시', count: 8, percentage: 5.1 },
    { region: '기타', count: 22, percentage: 14.1 },
  ],
  channelStats: [
    { channel: '네이버 검색', count: 52, percentage: 33.3 },
    { channel: '소개', count: 38, percentage: 24.4 },
    { channel: '인스타그램', count: 22, percentage: 14.1 },
    { channel: '블로그', count: 18, percentage: 11.5 },
    { channel: '카카오톡', count: 14, percentage: 9.0 },
    { channel: '기타', count: 12, percentage: 7.7 },
  ],

  // 환자 목록
  patientSummaries: mockPatients,

  // 진행상황별 통계 (누적 퍼널 - 각 단계를 거쳐간 환자 수)
  progressStats: {
    consulting: 156,    // 전체 문의 = 모든 환자가 전화상담 거침
    reserved: 98,       // 예약 이상 도달
    visited: 72,        // 내원 이상 도달
    treatmentBooked: 52, // 치료예약 이상 도달
    treatment: 44,      // 치료중 이상 도달
    completed: 30,      // 치료완료 이상 도달
    followup: 4,        // 사후관리 도달
    closed: 56,         // 종결 (별도 카운팅)
  },

  // 매출 현황
  revenueAnalysis: {
    achieved: { patients: 42, amount: 87500000, percentage: 38.5 },
    potential: {
      consultingOngoing: { patients: 46, amount: 62000000 },
      visitManagement: { patients: 20, amount: 34000000 },
      totalPatients: 66,
      totalAmount: 96000000,
      percentage: 42.3,
    },
    lost: {
      consultingLost: { patients: 38, amount: 32000000 },
      visitLost: { patients: 10, amount: 11500000 },
      totalPatients: 48,
      totalAmount: 43500000,
      percentage: 19.2,
    },
    summary: {
      totalInquiries: 156,
      totalPotentialAmount: 227000000,
      achievementRate: 38.5,
      potentialGrowth: 42.3,
      discountRate: 8.2,
      avgDealSize: 2083333,
    },
  },

  // 일별 추이
  dailyTrends: generateDailyTrends(),

  // 관심분야별
  interestBreakdown: [
    { interest: '임플란트', count: 52, agreed: 18, revenue: 42000000 },
    { interest: '치아교정', count: 28, agreed: 8, revenue: 19500000 },
    { interest: '라미네이트', count: 22, agreed: 6, revenue: 12600000 },
    { interest: '충치치료', count: 20, agreed: 12, revenue: 8400000 },
    { interest: '치아미백', count: 14, agreed: 5, revenue: 3500000 },
    { interest: '스케일링', count: 10, agreed: 8, revenue: 800000 },
    { interest: '크라운', count: 6, agreed: 3, revenue: 4200000 },
    { interest: '틀니', count: 4, agreed: 1, revenue: 2500000 },
  ],

  // 미동의 사유
  disagreeReasons: [
    { reason: '비용 부담', count: 32, percentage: 35.2 },
    { reason: '타원 비교', count: 18, percentage: 19.8 },
    { reason: '시간/일정 문제', count: 15, percentage: 16.5 },
    { reason: '연락 두절', count: 12, percentage: 13.2 },
    { reason: '거리 문제', count: 8, percentage: 8.8 },
    { reason: '기타', count: 6, percentage: 6.6 },
  ],

  // ── 새 필드들 ──

  ageDistribution: [
    { bracket: '10대', count: 4, percentage: 2.6 },
    { bracket: '20대', count: 22, percentage: 14.1 },
    { bracket: '30대', count: 48, percentage: 30.8 },
    { bracket: '40대', count: 38, percentage: 24.4 },
    { bracket: '50대', count: 28, percentage: 17.9 },
    { bracket: '60대+', count: 16, percentage: 10.3 },
  ],

  genderStats: { male: 68, female: 82, unknown: 6 },

  demographicCrossAnalysis: [
    { ageBracket: '20대', treatmentType: '치아교정', count: 12 },
    { ageBracket: '20대', treatmentType: '치아미백', count: 6 },
    { ageBracket: '20대', treatmentType: '라미네이트', count: 4 },
    { ageBracket: '30대', treatmentType: '임플란트', count: 10 },
    { ageBracket: '30대', treatmentType: '치아교정', count: 14 },
    { ageBracket: '30대', treatmentType: '라미네이트', count: 12 },
    { ageBracket: '30대', treatmentType: '충치치료', count: 8 },
    { ageBracket: '30대', treatmentType: '치아미백', count: 4 },
    { ageBracket: '40대', treatmentType: '임플란트', count: 18 },
    { ageBracket: '40대', treatmentType: '크라운', count: 8 },
    { ageBracket: '40대', treatmentType: '충치치료', count: 6 },
    { ageBracket: '40대', treatmentType: '라미네이트', count: 4 },
    { ageBracket: '50대', treatmentType: '임플란트', count: 16 },
    { ageBracket: '50대', treatmentType: '크라운', count: 6 },
    { ageBracket: '50대', treatmentType: '충치치료', count: 4 },
    { ageBracket: '60대+', treatmentType: '임플란트', count: 8 },
    { ageBracket: '60대+', treatmentType: '틀니', count: 4 },
    { ageBracket: '60대+', treatmentType: '충치치료', count: 2 },
  ],

  channelROI: [
    {
      channel: '네이버 검색', count: 52,
      reservedCount: 32, visitedCount: 24, paidCount: 12,
      reservedRate: 61.5, visitedRate: 46.2, paidRate: 23.1,
      totalRevenue: 28000000, avgDealSize: 2333333,
    },
    {
      channel: '소개', count: 38,
      reservedCount: 30, visitedCount: 26, paidCount: 18,
      reservedRate: 78.9, visitedRate: 68.4, paidRate: 47.4,
      totalRevenue: 38500000, avgDealSize: 2138889,
    },
    {
      channel: '인스타그램', count: 22,
      reservedCount: 14, visitedCount: 10, paidCount: 5,
      reservedRate: 63.6, visitedRate: 45.5, paidRate: 22.7,
      totalRevenue: 8500000, avgDealSize: 1700000,
    },
    {
      channel: '블로그', count: 18,
      reservedCount: 10, visitedCount: 6, paidCount: 3,
      reservedRate: 55.6, visitedRate: 33.3, paidRate: 16.7,
      totalRevenue: 5200000, avgDealSize: 1733333,
    },
    {
      channel: '카카오톡', count: 14,
      reservedCount: 8, visitedCount: 5, paidCount: 2,
      reservedRate: 57.1, visitedRate: 35.7, paidRate: 14.3,
      totalRevenue: 4800000, avgDealSize: 2400000,
    },
    {
      channel: '기타', count: 12,
      reservedCount: 4, visitedCount: 3, paidCount: 2,
      reservedRate: 33.3, visitedRate: 25.0, paidRate: 16.7,
      totalRevenue: 2500000, avgDealSize: 1250000,
    },
  ],

  treatmentAnalysis: [
    {
      treatment: '임플란트', totalCount: 52, agreedCount: 18,
      conversionRate: 34.6, totalRevenue: 42000000, avgDealSize: 2333333,
      disagreeReasons: [
        { reason: '비용 부담', count: 14 },
        { reason: '타원 비교', count: 8 },
        { reason: '시간/일정 문제', count: 5 },
      ],
    },
    {
      treatment: '치아교정', totalCount: 28, agreedCount: 8,
      conversionRate: 28.6, totalRevenue: 19500000, avgDealSize: 2437500,
      disagreeReasons: [
        { reason: '비용 부담', count: 8 },
        { reason: '치료기간 부담', count: 5 },
        { reason: '타원 비교', count: 3 },
      ],
    },
    {
      treatment: '라미네이트', totalCount: 22, agreedCount: 6,
      conversionRate: 27.3, totalRevenue: 12600000, avgDealSize: 2100000,
      disagreeReasons: [
        { reason: '비용 부담', count: 6 },
        { reason: '타원 비교', count: 4 },
        { reason: '심미 불안', count: 2 },
      ],
    },
    {
      treatment: '충치치료', totalCount: 20, agreedCount: 12,
      conversionRate: 60.0, totalRevenue: 8400000, avgDealSize: 700000,
      disagreeReasons: [
        { reason: '시간/일정 문제', count: 4 },
        { reason: '연락 두절', count: 2 },
      ],
    },
    {
      treatment: '치아미백', totalCount: 14, agreedCount: 5,
      conversionRate: 35.7, totalRevenue: 3500000, avgDealSize: 700000,
      disagreeReasons: [
        { reason: '타원 비교', count: 3 },
        { reason: '비용 부담', count: 2 },
      ],
    },
    {
      treatment: '크라운', totalCount: 6, agreedCount: 3,
      conversionRate: 50.0, totalRevenue: 4200000, avgDealSize: 1400000,
      disagreeReasons: [
        { reason: '시간/일정 문제', count: 2 },
      ],
    },
  ],

  weeklyPattern: [
    { dayOfWeek: 1, dayLabel: '월', avgCalls: 8.2, avgNewPatients: 4.8, avgAgreed: 2.1 },
    { dayOfWeek: 2, dayLabel: '화', avgCalls: 9.5, avgNewPatients: 5.6, avgAgreed: 2.4 },
    { dayOfWeek: 3, dayLabel: '수', avgCalls: 7.8, avgNewPatients: 4.2, avgAgreed: 1.8 },
    { dayOfWeek: 4, dayLabel: '목', avgCalls: 8.8, avgNewPatients: 5.2, avgAgreed: 2.2 },
    { dayOfWeek: 5, dayLabel: '금', avgCalls: 10.2, avgNewPatients: 6.1, avgAgreed: 2.8 },
    { dayOfWeek: 6, dayLabel: '토', avgCalls: 4.5, avgNewPatients: 2.8, avgAgreed: 1.2 },
    { dayOfWeek: 0, dayLabel: '일', avgCalls: 1.2, avgNewPatients: 0.6, avgAgreed: 0.2 },
  ],

  closedReasonStats: [
    { reason: '비용 부담', count: 18, percentage: 32.1 },
    { reason: '연락 두절', count: 12, percentage: 21.4 },
    { reason: '타원 결정', count: 10, percentage: 17.9 },
    { reason: '거리 멀음', count: 6, percentage: 10.7 },
    { reason: '일정 불가', count: 5, percentage: 8.9 },
    { reason: '기타', count: 5, percentage: 8.9 },
  ],

  executiveInsights: [
    '총 문의 156건으로 전월 대비 18건(+13.0%) 증가, 인바운드 12건 증가가 주요 요인',
    '소개 환자 전환율 47.4%로 전 채널 중 최고 — 소개 프로그램 강화 검토 필요',
    '임플란트 매출 비중 48%로 1위, 충치치료 전환율 60%로 가장 높은 전환 효율',
    '비용 부담이 미동의 사유 1위(35.2%) — 할부/분납 옵션 적극 안내 권장',
    '금요일 평균 통화 10.2건으로 피크 요일, 토/일 급감 — 평일 집중 콜 전략 유효',
    '30~40대 여성 교정/라미네이트 수요 집중 — 해당 타겟 마케팅 강화 기회',
  ],
};

// ─────────────────────────────────────────
// 풀 보고서 mock
// ─────────────────────────────────────────
const mockReport: MonthlyReportV2 = {
  _id: 'test-mock-report-001',
  yearMonth: '2026-01',
  year: 2026,
  month: 1,
  status: 'draft',
  stats: mockStats,
  managerAnswers: {
    question1: '미내원 환자 중 비용 부담이 가장 큰 원인이며, 특히 임플란트/교정 고액 치료에서 두드러짐. 할부 안내 강화 및 초진 할인 이벤트 검토 필요.',
    question2: '타원 비교 환자가 증가 추세. 당원의 차별점(디지털 장비, 전문의 경력)을 상담 시 더 적극적으로 어필해야 함.',
    question3: '1) 소개 환자 리워드 프로그램 도입 (소개 환자 전환율이 47%로 최고)\n2) 금요일 집중 콜 타임 확대 (피크 요일 활용)\n3) 30~40대 여성 타겟 인스타그램 광고 강화',
    question4: '이번 달 신규 문의 증가는 연말 블로그 콘텐츠 집중 투자 효과로 보임. 다음 달에도 콘텐츠 마케팅 지속 필요.',
  },
  directorFeedbacks: [
    {
      feedbackId: 'fb-001',
      content: '소개 환자 리워드 프로그램 좋은 아이디어입니다. 구체적인 리워드 금액과 운영 방안 정리해주세요.',
      targetSection: 'managerAnswers.question3',
      createdBy: 'director-001',
      createdByName: '김원장',
      createdAt: '2026-02-10T09:30:00Z',
    },
    {
      feedbackId: 'fb-002',
      content: '임플란트 전환율이 34.6%인데, 전월 대비 변화가 어떤지도 확인해주세요.',
      targetSection: 'treatmentAnalysis',
      createdBy: 'director-001',
      createdByName: '김원장',
      createdAt: '2026-02-10T09:35:00Z',
    },
  ],
  createdBy: 'manager-001',
  createdByName: '박매니저',
  generatedDate: '2026-02-01',
  createdAt: '2026-02-01T00:00:00Z',
  updatedAt: '2026-02-10T09:35:00Z',
};

// ─────────────────────────────────────────
// 테스트 페이지 컴포넌트
// ─────────────────────────────────────────
export default function TestMonthlyReportPage() {
  const [report, setReport] = useState<MonthlyReportV2>(mockReport);

  return (
    <div>
      {/* 테스트 안내 배너 */}
      <div className="bg-yellow-100 border-b border-yellow-300 px-4 py-2 text-center text-sm text-yellow-800 no-print">
        테스트 모드 — Mock 데이터로 렌더링 중 (API 호출 비활성)
      </div>

      <MonthlyReportFullView
        report={report}
        userRole="manager"
        currentUserId="manager-001"
        authToken="test-token"
        onReportUpdate={(updated) => {
          console.log('[TEST] onReportUpdate:', updated);
          setReport(updated);
        }}
      />
    </div>
  );
}
