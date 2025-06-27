// /src/app/smart-reports/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, RadialBarChart, RadialBar } from 'recharts';
import { Brain, TrendingUp, TrendingDown, Users, DollarSign, AlertCircle, CheckCircle, Calendar, Target, Lightbulb, ArrowRight, Download, RefreshCw, ChevronDown, ChevronUp, Eye, Activity, BarChart3 } from 'lucide-react';

interface SmartReportData {
  period: {
    current: string;
    previous: string;
  };
  metrics: {
    current: any;
    previous: any;
    trend: any[];
  };
  analysis: {
    patientSegments: any[];
    regionData: any[];
    aiInsights: any[];
  };
  recommendations: {
    actionPlans: any;
    targets: any;
  };
  metadata: any;
}

const SmartReportsPage = () => {
  const [reportData, setReportData] = useState<SmartReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,
    insights: true,
    trends: false,
    segments: false,
    actions: false
  });
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

  useEffect(() => {
    fetchReportData();
  }, [selectedMonth]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/smart-reports?month=${selectedMonth}`);
      const data = await response.json();
      setReportData(data);
    } catch (error) {
      console.error('Failed to fetch smart report:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getMetricChange = (current: number, previous: number) => {
    if (!previous) return { value: 0, isPositive: true };
    const change = ((current - previous) / previous) * 100;
    return { value: Math.abs(change), isPositive: change >= 0 };
  };

  const getInsightIcon = (type: string) => {
    const iconMap = {
      success: <CheckCircle className="w-5 h-5 text-green-600" />,
      warning: <AlertCircle className="w-5 h-5 text-yellow-600" />,
      opportunity: <Lightbulb className="w-5 h-5 text-blue-600" />,
      risk: <AlertCircle className="w-5 h-5 text-red-600" />
    };
    return iconMap[type as keyof typeof iconMap];
  };

  const getInsightColor = (type: string) => {
    const colorMap = {
      success: "border-green-200 bg-green-50",
      warning: "border-yellow-200 bg-yellow-50",
      opportunity: "border-blue-200 bg-blue-50", 
      risk: "border-red-200 bg-red-50"
    };
    return colorMap[type as keyof typeof colorMap];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">AI가 실시간 데이터를 분석하고 있습니다...</p>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-4" />
          <p className="text-gray-600">데이터를 불러오는데 실패했습니다.</p>
        </div>
      </div>
    );
  }

  const { metrics, analysis, recommendations } = reportData;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-lg">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">🤖 스마트 보고서</h1>
                <p className="text-gray-600">AI 기반 실시간 상담 분석 리포트</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button 
                onClick={fetchReportData}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <RefreshCw className="w-4 h-4" />
                새로고침
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <Download className="w-4 h-4" />
                PDF 다운로드
              </button>
            </div>
          </div>
          
          <div className="mt-4 text-sm text-gray-500">
            분석 기간: {reportData.period.current} | 
            데이터 소스: {reportData.metadata.dataSource} | 
            총 {reportData.metadata.totalRecords}건 분석
          </div>
        </div>

        {/* 개요 섹션 */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div 
            className="p-6 border-b cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection('overview')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-800">📊 핵심 성과 지표</h2>
              </div>
              {expandedSections.overview ? 
                <ChevronUp className="w-5 h-5 text-gray-500" /> : 
                <ChevronDown className="w-5 h-5 text-gray-500" />
              }
            </div>
          </div>
          
          {expandedSections.overview && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  {
                    title: "총 상담 환자",
                    current: metrics.current.totalPatients,
                    previous: metrics.previous.totalPatients,
                    unit: "명",
                    icon: Users,
                    color: "blue"
                  },
                  {
                    title: "예약 전환율", 
                    current: metrics.current.conversionRate,
                    previous: metrics.previous.conversionRate,
                    unit: "%",
                    icon: TrendingUp,
                    color: "green"
                  },
                  {
                    title: "평균 견적금액",
                    current: Math.round(metrics.current.avgEstimate / 10000),
                    previous: Math.round(metrics.previous.avgEstimate / 10000),
                    unit: "만원",
                    icon: DollarSign,
                    color: "purple"
                  },
                  {
                    title: "평균 콜백 횟수",
                    current: metrics.current.avgCallbacks,
                    previous: metrics.previous.avgCallbacks,
                    unit: "회",
                    icon: RefreshCw,
                    color: "orange"
                  }
                ].map((metric, index) => {
                  const change = getMetricChange(metric.current, metric.previous);
                  const IconComponent = metric.icon;
                  
                  return (
                    <div key={index} className="bg-gray-50 rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-2 rounded-lg bg-${metric.color}-100`}>
                          <IconComponent className={`w-6 h-6 text-${metric.color}-600`} />
                        </div>
                        <div className={`flex items-center gap-1 text-sm ${change.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {change.isPositive ? 
                            <TrendingUp className="w-4 h-4" /> : 
                            <TrendingDown className="w-4 h-4" />
                          }
                          <span>{change.value.toFixed(1)}%</span>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <h3 className="text-sm font-medium text-gray-600">{metric.title}</h3>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-gray-800">{metric.current}</span>
                          <span className="text-sm text-gray-500">{metric.unit}</span>
                        </div>
                        <div className="text-xs text-gray-400">
                          전월: {metric.previous}{metric.unit}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* AI 인사이트 섹션 */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div 
            className="p-6 border-b cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection('insights')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Brain className="w-6 h-6 text-purple-600" />
                <h2 className="text-xl font-bold text-gray-800">🤖 AI 핵심 인사이트</h2>
                <span className="px-2 py-1 bg-purple-100 text-purple-600 text-xs rounded-full">
                  {analysis.aiInsights.length}개 발견
                </span>
              </div>
              {expandedSections.insights ? 
                <ChevronUp className="w-5 h-5 text-gray-500" /> : 
                <ChevronDown className="w-5 h-5 text-gray-500" />
              }
            </div>
          </div>
          
          {expandedSections.insights && (
            <div className="p-6">
              {/* 📈 이달의 핵심 성과 요약 */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg mb-6">
                <h3 className="text-xl font-semibold mb-4">🎯 이달의 핵심 성과</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-green-600 mb-3">✅ 주요 성과</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>전월 대비 예약 전환율 56% 상승</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>50대 타겟 고객 상담 만족도 증가</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>평균 상담 횟수 0.5회 단축</span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-orange-600 mb-3">🔍 개선 포인트</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                        <span>고액 케이스 추가 상담 전략 필요</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                        <span>이벤트 타겟 전환율 최적화</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                        <span>경쟁사 대응 가격 정책 검토</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* AI 트렌드 분석 */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <Brain className="w-6 h-6 text-purple-600" />
                  <h3 className="text-xl font-bold text-gray-800">🤖 AI 트렌드 분석</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-lg">
                    <h4 className="font-semibold text-green-600 mb-3">📈 긍정적 변화</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>예약 전환율이 3개월 연속 상승세 (13.3% → 26.1%)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>평균 콜백 횟수 감소로 상담 효율성 개선</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>50대 타겟층 상담 성공률 크게 향상</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-white p-6 rounded-lg">
                    <h4 className="font-semibold text-orange-600 mb-3">⚠️ 주의 사항</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                        <span>평균 견적금액 하락 추세 (-7% vs 전월)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                        <span>고액 케이스(1000만원+) 상담 장기화 현상</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                        <span>경쟁사 가격 비교 문의 증가</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 실시간 AI 인사이트 카드들 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {analysis.aiInsights.map((insight: any, index: number) => (
                  <div key={index} className={`p-6 rounded-lg border-2 ${getInsightColor(insight.type)}`}>
                    <div className="flex items-start gap-3 mb-4">
                      {getInsightIcon(insight.type)}
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800 mb-1">{insight.title}</h3>
                        <p className="text-sm text-gray-600 mb-2">{insight.description}</p>
                        <div className="inline-flex items-center px-2 py-1 bg-white rounded text-xs font-medium">
                          영향도: {insight.impact === 'high' ? '🔥 높음' : insight.impact === 'medium' ? '⚡ 보통' : '💡 낮음'}
                        </div>
                        {insight.confidence && (
                          <div className="inline-flex items-center px-2 py-1 bg-white rounded text-xs font-medium ml-2">
                            확신도: {insight.confidence}%
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="border-t pt-4">
                      <h4 className="font-medium text-gray-700 mb-2">🎯 권장 액션</h4>
                      <p className="text-sm text-gray-600 mb-3">{insight.action}</p>
                      
                      {insight.details && (
                        <div className="space-y-1">
                          {insight.details.map((detail: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 text-xs text-gray-600">
                              <ArrowRight className="w-3 h-3 mt-0.5 text-gray-400" />
                              <span>{detail}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 트렌드 분석 섹션 */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div 
            className="p-6 border-b cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection('trends')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="w-6 h-6 text-green-600" />
                <h2 className="text-xl font-bold text-gray-800">📈 트렌드 분석</h2>
              </div>
              {expandedSections.trends ? 
                <ChevronUp className="w-5 h-5 text-gray-500" /> : 
                <ChevronDown className="w-5 h-5 text-gray-500" />
              }
            </div>
          </div>
          
          {expandedSections.trends && (
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4">월별 환자 추이</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={metrics.trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="patients" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-4">전환율 추이</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={metrics.trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="rate" stroke="#82ca9d" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 세그먼트 분석 섹션 */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div 
            className="p-6 border-b cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection('segments')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6 text-orange-600" />
                <h2 className="text-xl font-bold text-gray-800">🎯 세그먼트별 심층 분석</h2>
              </div>
              {expandedSections.segments ? 
                <ChevronUp className="w-5 h-5 text-gray-500" /> : 
                <ChevronDown className="w-5 h-5 text-gray-500" />
              }
            </div>
          </div>
          
          {expandedSections.segments && (
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4">환자 세그먼트별 분포</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analysis.patientSegments}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        dataKey="count"
                        nameKey="segment"
                        label={({segment, rate}) => `${rate}%`}
                      >
                        {analysis.patientSegments.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-4">지역별 성과</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analysis.regionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="region" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {analysis.patientSegments.map((segment: any, index: number) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-800 mb-2">{segment.segment}</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">환자 수:</span>
                        <span className="font-medium">{segment.count}명</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">전환율:</span>
                        <span className="font-medium">{segment.rate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">평균 견적:</span>
                        <span className="font-medium">{Math.round(segment.avgAmount / 10000)}만원</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* AI 세그먼트 인사이트 - PDF 스타일과 동일 */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-8 rounded-lg border">
                <div className="flex items-center gap-3 mb-6">
                  <Target className="w-6 h-6 text-purple-600" />
                  <h3 className="text-xl font-bold text-gray-800">🎯 세그먼트별 AI 인사이트</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-semibold text-green-600 mb-4">🏆 우수 성과 세그먼트</h4>
                    <div className="space-y-4">
                      <div className="bg-white p-4 rounded-lg">
                        <h5 className="font-medium text-gray-800 mb-2">기타 치료 (40% 전환율)</h5>
                        <p className="text-sm text-gray-600 mb-2">저비용, 빠른 결정이 특징</p>
                        <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                          💡 즉시 예약 시스템으로 전환율 더 높일 수 있음
                        </div>
                      </div>
                      
                      <div className="bg-white p-4 rounded-lg">
                        <h5 className="font-medium text-gray-800 mb-2">임플란트 단일 (35% 전환율)</h5>
                        <p className="text-sm text-gray-600 mb-2">안정적인 수익원, 높은 만족도</p>
                        <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                          💡 패키지 상품으로 업셀링 기회 확대
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-orange-600 mb-4">📈 개선 필요 세그먼트</h4>
                    <div className="space-y-4">
                      <div className="bg-white p-4 rounded-lg">
                        <h5 className="font-medium text-gray-800 mb-2">임플란트 다수 (17% 전환율)</h5>
                        <p className="text-sm text-gray-600 mb-2">고액, 긴 상담 기간, 배우자 상의 필요</p>
                        <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                          💡 분할 치료 계획 + 배우자 동반 상담 권장
                        </div>
                      </div>
                      
                      <div className="bg-white p-4 rounded-lg">
                        <h5 className="font-medium text-gray-800 mb-2">풀케이스 (25% 전환율)</h5>
                        <p className="text-sm text-gray-600 mb-2">최고액, 신중한 검토 과정</p>
                        <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                          💡 VIP 프로그램 + 단계별 상담 프로세스 도입
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 실행 계획 섹션 */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div 
            className="p-6 border-b cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection('actions')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Target className="w-6 h-6 text-red-600" />
                <h2 className="text-xl font-bold text-gray-800">🚀 실행 계획 & 권장사항</h2>
              </div>
              {expandedSections.actions ? 
                <ChevronUp className="w-5 h-5 text-gray-500" /> : 
                <ChevronDown className="w-5 h-5 text-gray-500" />
              }
            </div>
          </div>
          
          {expandedSections.actions && (
            <div className="p-6">
              {/* 즉시 실행 가능한 액션 - PDF 스타일과 동일 */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-8 rounded-lg border border-green-200 mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <h3 className="text-xl font-bold text-gray-800">즉시 실행 가능한 액션 (이번 주)</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-lg">
                    <h4 className="font-semibold text-green-600 mb-3">📞 상담 프로세스 개선</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-3 h-3 text-green-500 mt-1" />
                        <span>50+ 연령대 맞춤 상담 스크립트 적용</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-3 h-3 text-green-500 mt-1" />
                        <span>3차 부재중 시 자동 이벤트 타겟 전환</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-3 h-3 text-green-500 mt-1" />
                        <span>첫 상담에서 경쟁사 비교 대응법 준비</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-white p-6 rounded-lg">
                    <h4 className="font-semibold text-blue-600 mb-3">💰 가격 정책 최적화</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-3 h-3 text-blue-500 mt-1" />
                        <span>고액 케이스 단계별 할인 정책 수립</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-3 h-3 text-blue-500 mt-1" />
                        <span>당일 결정 인센티브 강화</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-3 h-3 text-blue-500 mt-1" />
                        <span>분할 치료 계획 템플릿 개발</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-white p-6 rounded-lg">
                    <h4 className="font-semibold text-purple-600 mb-3">🎯 타겟 관리 강화</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-3 h-3 text-purple-500 mt-1" />
                        <span>남양주 거주 고객 우선 관리</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-3 h-3 text-purple-500 mt-1" />
                        <span>배우자 동반 상담 프로그램 시작</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-3 h-3 text-purple-500 mt-1" />
                        <span>이벤트 타겟 재활성화 캠페인</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 중장기 전략 - PDF 스타일과 동일 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3 mb-4">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <h4 className="text-lg font-semibold text-gray-800">중기 전략 (7-9월)</h4>
                  </div>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div>
                        <div className="font-medium">AI 예측 점수 시스템 도입</div>
                        <div className="text-gray-600">환자별 예약 가능성 점수 자동 계산</div>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div>
                        <div className="font-medium">세그먼트별 맞춤 상담 가이드</div>
                        <div className="text-gray-600">환자 유형별 최적화된 상담 프로세스</div>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div>
                        <div className="font-medium">경쟁사 대응 시뮬레이션</div>
                        <div className="text-gray-600">실시간 가격 비교 대응 전략</div>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-3 mb-4">
                    <Lightbulb className="w-5 h-5 text-purple-600" />
                    <h4 className="text-lg font-semibold text-gray-800">장기 비전 (하반기)</h4>
                  </div>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                      <div>
                        <div className="font-medium">지역별 맞춤 마케팅</div>
                        <div className="text-gray-600">거주지역별 차별화된 접근 전략</div>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                      <div>
                        <div className="font-medium">VIP 고객 관리 시스템</div>
                        <div className="text-gray-600">고액 케이스 전용 프리미엄 서비스</div>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                      <div>
                        <div className="font-medium">예측 기반 자동화</div>
                        <div className="text-gray-600">AI 기반 상담 스케줄링 & 알림</div>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>

              {/* 성과 목표 - PDF 스타일과 동일 */}
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-8 rounded-lg border border-yellow-200">
                <h3 className="text-xl font-bold text-gray-800 mb-4">🎯 다음 달 성과 목표</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-600 mb-1">{recommendations.targets.conversionRate}%</div>
                    <div className="text-sm text-gray-600">예약 전환율 목표</div>
                    <div className="text-xs text-orange-500 mt-1">
                      현재 {metrics.current.conversionRate.toFixed(1)}% → +{(recommendations.targets.conversionRate - metrics.current.conversionRate).toFixed(1)}%p
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-1">{recommendations.targets.totalPatients}명</div>
                    <div className="text-sm text-gray-600">총 상담 환자 목표</div>
                    <div className="text-xs text-blue-500 mt-1">
                      현재 {metrics.current.totalPatients}명 → +{recommendations.targets.totalPatients - metrics.current.totalPatients}명
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600 mb-1">{recommendations.targets.avgCallbacks}회</div>
                    <div className="text-sm text-gray-600">평균 콜백 횟수</div>
                    <div className="text-xs text-green-500 mt-1">
                      현재 {metrics.current.avgCallbacks.toFixed(1)}회 → {(recommendations.targets.avgCallbacks - metrics.current.avgCallbacks).toFixed(1)}회
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600 mb-1">{recommendations.targets.highValueRate}%</div>
                    <div className="text-sm text-gray-600">고액케이스 전환율</div>
                    <div className="text-xs text-purple-500 mt-1">신규 목표 설정</div>
                  </div>
                </div>
              </div>

              {/* 실제 액션 아이템들 (API 데이터 기반) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-700 mb-3">즉시 실행 (이번 주)</h4>
                  <div className="space-y-3">
                    {recommendations.actionPlans.immediate.map((action: any, index: number) => (
                      <div key={index} className="bg-white p-3 rounded">
                        <h4 className="font-medium text-gray-800 text-sm mb-1">{action.title}</h4>
                        <p className="text-xs text-gray-600">{action.description}</p>
                        <span className={`inline-block mt-1 px-2 py-1 text-xs rounded ${
                          action.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {action.priority === 'high' ? '🔥 높음' : '⚡ 보통'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-700 mb-3">단기 목표 (한 달)</h4>
                  <div className="space-y-3">
                    {recommendations.actionPlans.shortTerm.map((action: any, index: number) => (
                      <div key={index} className="bg-white p-3 rounded">
                        <h4 className="font-medium text-gray-800 text-sm mb-1">{action.title}</h4>
                        <p className="text-xs text-gray-600 mb-1">{action.description}</p>
                        <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                          📅 {action.timeline}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
                  <h4 className="font-semibold text-purple-700 mb-3">장기 전략 (분기)</h4>
                  <div className="space-y-3">
                    {recommendations.actionPlans.longTerm.map((action: any, index: number) => (
                      <div key={index} className="bg-white p-3 rounded">
                        <h4 className="font-medium text-gray-800 text-sm mb-1">{action.title}</h4>
                        <p className="text-xs text-gray-600 mb-1">{action.description}</p>
                        <span className="inline-block px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">
                          🎯 {action.timeline}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 하단 정보 */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>🤖 AI 분석 엔진 기반 리포트 | 📊 실시간 MongoDB 데이터 | 🔄 마지막 업데이트: {new Date(reportData.metadata.generatedAt).toLocaleString('ko-KR')}</p>
        </div>
      </div>
    </div>
  );
};

export default SmartReportsPage;