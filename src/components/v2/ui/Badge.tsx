// src/components/v2/ui/Badge.tsx
'use client';

import React from 'react';
import { PatientStatus, PATIENT_STATUS_CONFIG } from '@/types/v2';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
}: BadgeProps) {
  const variantStyles = {
    default: 'bg-gray-100 text-gray-700',
    primary: 'bg-blue-100 text-blue-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-sky-100 text-sky-700',
    purple: 'bg-purple-100 text-purple-700',
  };

  const sizeStyles = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-xs',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
}

// 환자 상태 뱃지
interface StatusBadgeProps {
  status: PatientStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = PATIENT_STATUS_CONFIG[status];

  return (
    <Badge className={config.bgColor} size={size}>
      {config.label}
    </Badge>
  );
}

// AI 분류 뱃지
interface ClassificationBadgeProps {
  classification: string;
  size?: 'sm' | 'md';
}

export function ClassificationBadge({ classification, size = 'md' }: ClassificationBadgeProps) {
  const styleMap: Record<string, string> = {
    '신규환자': 'bg-blue-100 text-blue-700',
    '기존환자': 'bg-emerald-100 text-emerald-700',
    '콜백필요': 'bg-amber-100 text-amber-700',
    '부재중': 'bg-gray-100 text-gray-500',
    '거래처': 'bg-slate-100 text-slate-600',
    '스팸': 'bg-red-100 text-red-600',
  };

  return (
    <Badge className={styleMap[classification] || styleMap['기존환자']} size={size}>
      {classification}
    </Badge>
  );
}

// 신규 뱃지
export function NewBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <Badge variant="primary" size={size}>
      신규
    </Badge>
  );
}

// AI 뱃지
export function AIBadge({ confidence, size = 'sm' }: { confidence?: number; size?: 'sm' | 'md' }) {
  return (
    <Badge variant="purple" size={size}>
      AI {confidence ? `${confidence}%` : ''}
    </Badge>
  );
}

// 상담 결과 뱃지
interface ConsultationStatusBadgeProps {
  status: 'agreed' | 'disagreed' | 'pending';
  size?: 'sm' | 'md';
}

export function ConsultationStatusBadge({ status, size = 'md' }: ConsultationStatusBadgeProps) {
  const config = {
    agreed: { label: '동의', variant: 'success' as const },
    disagreed: { label: '미동의', variant: 'danger' as const },
    pending: { label: '보류', variant: 'warning' as const },
  };

  const { label, variant } = config[status];
  return <Badge variant={variant} size={size}>{label}</Badge>;
}

export default Badge;
