'use client'

// Recharts와 TypeScript 간의 타입 호환성 문제를 해결하기 위해 더 유연한 타입 설정
import React from 'react';
import type { PieProps } from 'recharts';

// 타입 호환성 오류를 방지하기 위해 'as any' 사용
const { PieChart, Pie, Cell, ResponsiveContainer, Legend } = require('recharts') as any;

interface ChartData {
  name: string;
  value: number;
  color: string;
}

interface ReminderChartProps {
  reminderCounts: {
    initial: number;
    first: number;
    second: number;
    third: number;
  };
}

export default function ReminderChart({ reminderCounts }: ReminderChartProps) {
  const { initial, first, second, third } = reminderCounts;
  const totalCalls = initial + first + second + third;

  // 차트 데이터 준비
  const data: ChartData[] = [
    { name: '초기 콜', value: initial, color: '#4fc3f7' },
    { name: '1차', value: first, color: '#ffb74d' },
    { name: '2차', value: second, color: '#ff9e80' },
    { name: '3차', value: third, color: '#ef5350' },
  ];

  // 타입 안전한 포맷터 함수
  const legendFormatter = (value: string) => {
    return <span className="text-sm text-text-secondary">{value}</span>;
  };

  return (
    <div className="card">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-text-primary">리마인드 콜 현황</h2>
      </div>

      <div className="aspect-square relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              formatter={legendFormatter}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* 중앙 텍스트 */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="text-xl font-bold text-text-primary">{totalCalls}</p>
          <p className="text-xs text-text-secondary">총 콜</p>
        </div>
      </div>

      {/* 범례 */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4">
        {data.map((item) => (
          <div key={item.name} className="flex items-center">
            <div className="w-3 h-3 rounded-sm mr-2" style={{ backgroundColor: item.color }} />
            <span className="text-sm text-text-secondary">
              {item.name}: {item.value}건
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}