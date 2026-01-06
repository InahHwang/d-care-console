// src/components/v2/ui/Skeleton.tsx
'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const variantStyles = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg',
  };

  const animationStyles = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`bg-gray-200 ${variantStyles[variant]} ${animationStyles[animation]} ${className}`}
      style={style}
    />
  );
}

// 테이블 행 스켈레톤
export function TableRowSkeleton({ columns = 8 }: { columns?: number }) {
  return (
    <div className="grid gap-4 px-5 py-4 items-center" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} height={16} className="w-full" />
      ))}
    </div>
  );
}

// 테이블 스켈레톤
export function TableSkeleton({ rows = 5, columns = 8 }: { rows?: number; columns?: number }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="grid gap-4 px-5 py-3 bg-gray-50 border-b" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} height={14} className="w-3/4" />
        ))}
      </div>
      {/* 바디 */}
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <TableRowSkeleton key={i} columns={columns} />
        ))}
      </div>
    </div>
  );
}

// 카드 스켈레톤
export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-2xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <Skeleton width={80} height={16} />
        <Skeleton variant="circular" width={24} height={24} />
      </div>
      <Skeleton width={100} height={36} className="mb-1" />
      <Skeleton width={120} height={14} />
    </div>
  );
}

// 통계 카드 그리드 스켈레톤
export function StatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

// 리스트 아이템 스켈레톤
export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton variant="rounded" width={40} height={40} />
      <div className="flex-1">
        <Skeleton width="60%" height={16} className="mb-1" />
        <Skeleton width="40%" height={14} />
      </div>
    </div>
  );
}

// 리스트 스켈레톤
export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </div>
  );
}

// 필터 탭 스켈레톤
export function FilterTabsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="rounded" width={80} height={36} />
      ))}
    </div>
  );
}

// 환자 상세 스켈레톤
export function PatientDetailSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-6">
      {/* 좌측 정보 패널 */}
      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <Skeleton width={120} height={24} className="mb-2" />
              <Skeleton width={100} height={16} />
            </div>
            <Skeleton variant="rounded" width={60} height={24} />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton width={60} height={14} />
                <Skeleton width={100} height={14} />
              </div>
            ))}
          </div>
        </div>
        <Skeleton variant="rounded" height={100} className="w-full" />
      </div>

      {/* 타임라인 */}
      <div className="col-span-2">
        <div className="bg-white rounded-2xl p-5">
          <div className="flex border-b mb-4">
            <Skeleton width={80} height={36} className="mr-4" />
            <Skeleton width={60} height={36} />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton variant="circular" width={40} height={40} />
                <div className="flex-1">
                  <Skeleton variant="rounded" height={100} className="w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Skeleton;
