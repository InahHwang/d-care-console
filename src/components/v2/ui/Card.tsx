// src/components/v2/ui/Card.tsx
'use client';

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export function Card({ children, className = '', onClick, hover = false }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl ${hover ? 'hover:bg-gray-50 cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

interface StatsCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  subtextColor?: 'gray' | 'emerald' | 'amber' | 'red';
  icon?: React.ReactNode;
  iconBgColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
    label: string;
  };
}

export function StatsCard({
  title,
  value,
  subtext,
  subtextColor = 'gray',
  icon,
  iconBgColor = 'text-gray-400',
  trend,
}: StatsCardProps) {
  const subtextColorClass = {
    gray: 'text-gray-400',
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    red: 'text-red-500',
  }[subtextColor];

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-500">{title}</span>
        {icon && <span className={iconBgColor}>{icon}</span>}
      </div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      {(subtext || trend) && (
        <div className={`text-sm mt-1 ${subtextColorClass}`}>
          {trend ? (
            <span className={`flex items-center gap-1 ${trend.isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
              {trend.isPositive ? '↑' : '↓'} {trend.label}
            </span>
          ) : (
            subtext
          )}
        </div>
      )}
    </Card>
  );
}

interface CardHeaderProps {
  title: string;
  icon?: React.ReactNode;
  iconColor?: string;
  action?: React.ReactNode;
  badge?: string | number;
}

export function CardHeader({ title, icon, iconColor = 'text-gray-500', action, badge }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-bold text-gray-900 flex items-center gap-2">
        {icon && <span className={iconColor}>{icon}</span>}
        {title}
        {badge !== undefined && (
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </h3>
      {action}
    </div>
  );
}

interface AlertCardProps {
  children: React.ReactNode;
  type: 'warning' | 'error' | 'info' | 'success';
  className?: string;
}

export function AlertCard({ children, type, className = '' }: AlertCardProps) {
  const typeStyles = {
    warning: 'border-l-4 border-amber-400',
    error: 'border-l-4 border-red-400',
    info: 'border-l-4 border-blue-400',
    success: 'border-l-4 border-emerald-400',
  };

  return (
    <Card className={`p-5 ${typeStyles[type]} ${className}`}>
      {children}
    </Card>
  );
}

export default Card;
