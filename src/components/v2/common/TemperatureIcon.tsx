// src/components/v2/common/TemperatureIcon.tsx
'use client';

import React from 'react';
import { Flame, Thermometer, Snowflake } from 'lucide-react';
import type { Temperature } from '@/types/v2';

interface TemperatureIconProps {
  temperature: Temperature;
  size?: number;
  showLabel?: boolean;
}

const TEMPERATURE_CONFIG: Record<Temperature, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  label: string;
}> = {
  hot: {
    icon: Flame,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    label: 'Hot',
  },
  warm: {
    icon: Thermometer,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
    label: 'Warm',
  },
  cold: {
    icon: Snowflake,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    label: 'Cold',
  },
};

export function TemperatureIcon({ temperature, size = 16, showLabel = false }: TemperatureIconProps) {
  const config = TEMPERATURE_CONFIG[temperature] || TEMPERATURE_CONFIG.warm;
  const Icon = config.icon;

  if (showLabel) {
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${config.bgColor}`}>
        <Icon size={size} className={config.color} />
        <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
      </div>
    );
  }

  return <Icon size={size} className={config.color} />;
}

export default TemperatureIcon;
