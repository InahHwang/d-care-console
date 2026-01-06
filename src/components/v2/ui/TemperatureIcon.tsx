// src/components/v2/ui/TemperatureIcon.tsx
'use client';

import React from 'react';
import { Flame, Thermometer, Snowflake } from 'lucide-react';
import { Temperature } from '@/types/v2';

interface TemperatureIconProps {
  temperature: Temperature | null | undefined;
  size?: number;
  showLabel?: boolean;
  className?: string;
}

export function TemperatureIcon({
  temperature,
  size = 14,
  showLabel = false,
  className = '',
}: TemperatureIconProps) {
  if (!temperature) return null;

  const config = {
    hot: {
      icon: Flame,
      color: 'text-red-500',
      bgColor: 'bg-red-50',
      label: '높음',
    },
    warm: {
      icon: Thermometer,
      color: 'text-amber-500',
      bgColor: 'bg-amber-50',
      label: '중간',
    },
    cold: {
      icon: Snowflake,
      color: 'text-blue-400',
      bgColor: 'bg-blue-50',
      label: '낮음',
    },
  };

  const tempConfig = config[temperature];
  const Icon = tempConfig.icon;

  if (showLabel) {
    return (
      <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${tempConfig.bgColor} ${tempConfig.color} ${className}`}>
        <Icon size={size} />
        <span className="text-xs font-medium">{tempConfig.label}</span>
      </div>
    );
  }

  return <Icon size={size} className={`${tempConfig.color} ${className}`} />;
}

// 관심도 선택기
interface TemperatureSelectorProps {
  value: Temperature | null;
  onChange: (temp: Temperature) => void;
  className?: string;
}

export function TemperatureSelector({ value, onChange, className = '' }: TemperatureSelectorProps) {
  const options: Temperature[] = ['hot', 'warm', 'cold'];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {options.map((temp) => (
        <button
          key={temp}
          onClick={() => onChange(temp)}
          className={`p-2 rounded-lg transition-colors ${
            value === temp
              ? temp === 'hot'
                ? 'bg-red-100 text-red-600'
                : temp === 'warm'
                ? 'bg-amber-100 text-amber-600'
                : 'bg-blue-100 text-blue-600'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
        >
          <TemperatureIcon temperature={temp} size={18} />
        </button>
      ))}
    </div>
  );
}

export default TemperatureIcon;
