// src/utils/callLogExcelExport.ts
import * as XLSX from 'xlsx';

interface CallLogForExport {
  callTime: string;
  callType: 'inbound' | 'outbound';
  duration: number;
  phone: string;
  calledNumber?: string;
  patientName: string;
  classification: string;
  interest: string;
  summary: string;
  temperature: string;
  status: string;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return '부재중';
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return min > 0 ? `${min}분 ${sec}초` : `${sec}초`;
}

function formatTemperature(temp: string): string {
  switch (temp) {
    case 'hot': return '높음';
    case 'warm': return '중간';
    case 'cold': return '낮음';
    default: return '-';
  }
}

function formatCallTime(callTime: string): string {
  const date = new Date(callTime);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

export function exportCallLogsToExcel(callLogs: CallLogForExport[], fileName: string) {
  const rows = callLogs.map((log) => ({
    '날짜/시간': formatCallTime(log.callTime),
    '유형': log.callType === 'inbound' ? '수신' : '발신',
    '회선': log.calledNumber || '-',
    '전화번호': log.phone,
    '환자명': log.patientName || '-',
    '분류': log.classification || '-',
    '관심분야': log.interest || '-',
    '관심도': formatTemperature(log.temperature),
    '통화시간': formatDuration(log.duration),
    'AI 요약': log.summary || '-',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // 열 너비 설정
  ws['!cols'] = [
    { wch: 18 }, // 날짜/시간
    { wch: 6 },  // 유형
    { wch: 14 }, // 회선
    { wch: 15 }, // 전화번호
    { wch: 10 }, // 환자명
    { wch: 8 },  // 분류
    { wch: 12 }, // 관심분야
    { wch: 8 },  // 관심도
    { wch: 10 }, // 통화시간
    { wch: 50 }, // AI 요약
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '통화기록');
  XLSX.writeFile(wb, fileName);
}
