// src/app/v2/reports/components/MonthlyReport-PatientStats.tsx
// V2 환자 통계 - 평균 연령, 지역별, 유입경로별
'use client';

import React from 'react';
import { Users, MapPin } from 'lucide-react';
import type { MonthlyStatsV2 } from './MonthlyReport-Types';

interface MonthlyReportPatientStatsProps {
  stats: MonthlyStatsV2;
}

const MonthlyReportPatientStats: React.FC<MonthlyReportPatientStatsProps> = ({ stats }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6">
      <div className="p-6 border-b bg-green-50">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-green-600" />
          환자 통계
        </h2>
      </div>
      <div className="p-6">
        {/* 평균 연령 */}
        <div className="mb-6">
          <h3 className="font-medium text-gray-900 mb-2">평균 연령</h3>
          <div className="text-2xl font-bold text-gray-900">{stats.averageAge}세</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 지역별 통계 */}
          <div>
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              지역별 통계
            </h3>
            <div className="space-y-3">
              {stats.regionStats.map((region, index) => (
                <div key={region.region} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </span>
                    <span className="text-sm">{region.region}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${Math.min((region.percentage / 30) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12">{region.percentage.toFixed(1)}%</span>
                    <span className="text-xs text-gray-500 w-8">({region.count}명)</span>
                  </div>
                </div>
              ))}
              {stats.regionStats.length === 0 && (
                <p className="text-sm text-gray-400">데이터 없음</p>
              )}
            </div>
          </div>

          {/* 유입경로 */}
          <div>
            <h3 className="font-medium text-gray-900 mb-4">유입경로</h3>
            <div className="space-y-3">
              {stats.channelStats.map((channel, index) => (
                <div key={channel.channel} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-green-100 text-green-800 rounded-full flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </span>
                    <span className="text-sm">{channel.channel}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: `${Math.min((channel.percentage / 45) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12">{channel.percentage.toFixed(1)}%</span>
                    <span className="text-xs text-gray-500 w-8">({channel.count}건)</span>
                  </div>
                </div>
              ))}
              {stats.channelStats.length === 0 && (
                <p className="text-sm text-gray-400">데이터 없음</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyReportPatientStats;
