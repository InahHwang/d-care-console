// src/lib/v2/db/schema-validation.ts
// V2 핵심 컬렉션에 MongoDB Schema Validation 적용
// validationLevel: 'moderate' → 기존 데이터에 영향 없음, 새 데이터만 검증

import { Db } from 'mongodb';

export async function applyV2SchemaValidation(db: Db): Promise<void> {
  console.log('[Schema] V2 스키마 검증 적용 시작...');

  // 1. patients_v2
  try {
    await db.command({
      collMod: 'patients_v2',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['name', 'phone', 'status', 'temperature', 'createdAt'],
          properties: {
            name: { bsonType: 'string', description: '환자 이름 (필수)' },
            phone: { bsonType: 'string', description: '전화번호 (필수)' },
            status: {
              enum: [
                'consulting', 'reserved', 'visited', 'treatmentBooked',
                'treatment', 'completed', 'followup', 'closed',
              ],
              description: '환자 상태',
            },
            temperature: {
              enum: ['hot', 'warm', 'cold'],
              description: '환자 온도',
            },
            clinicId: { bsonType: 'string', description: '클리닉 ID' },
            age: {
              bsonType: ['int', 'double', 'null'],
              minimum: 0,
              maximum: 150,
              description: '나이 (0~150)',
            },
            createdAt: { bsonType: 'string', description: '생성 일시' },
          },
        },
      },
      validationLevel: 'moderate',
      validationAction: 'error',
    });
    console.log('[Schema] patients_v2 검증 적용 완료');
  } catch (e: any) {
    // 컬렉션이 없는 경우(code 26)는 무시
    if (e.code !== 26) console.warn('[Schema] patients_v2 검증 적용 실패:', e.message);
  }

  // 2. callLogs_v2
  try {
    await db.command({
      collMod: 'callLogs_v2',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['phone', 'direction', 'status', 'duration'],
          properties: {
            phone: { bsonType: 'string', description: '전화번호 (필수)' },
            direction: {
              enum: ['inbound', 'outbound'],
              description: '통화 방향',
            },
            status: {
              enum: ['connected', 'missed', 'busy'],
              description: '통화 상태',
            },
            duration: {
              bsonType: ['int', 'double'],
              minimum: 0,
              description: '통화 시간 (초)',
            },
            aiStatus: {
              enum: ['pending', 'processing', 'completed', 'failed'],
              description: 'AI 분석 상태',
            },
            clinicId: { bsonType: 'string', description: '클리닉 ID' },
          },
        },
      },
      validationLevel: 'moderate',
      validationAction: 'error',
    });
    console.log('[Schema] callLogs_v2 검증 적용 완료');
  } catch (e: any) {
    if (e.code !== 26) console.warn('[Schema] callLogs_v2 검증 적용 실패:', e.message);
  }

  // 3. consultations_v2
  try {
    await db.command({
      collMod: 'consultations_v2',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['patientId', 'type', 'status', 'consultantName', 'createdAt'],
          properties: {
            patientId: { bsonType: 'string', description: '환자 ID (필수)' },
            type: {
              enum: ['phone', 'visit'],
              description: '상담 유형',
            },
            status: {
              enum: ['agreed', 'disagreed', 'pending'],
              description: '상담 결과',
            },
            consultantName: { bsonType: 'string', description: '상담사 이름 (필수)' },
            originalAmount: {
              bsonType: ['int', 'double'],
              minimum: 0,
              description: '원가',
            },
            discountRate: {
              bsonType: ['int', 'double'],
              minimum: 0,
              maximum: 100,
              description: '할인율 (0~100)',
            },
            clinicId: { bsonType: 'string', description: '클리닉 ID' },
            createdAt: { bsonType: 'string', description: '생성 일시' },
          },
        },
      },
      validationLevel: 'moderate',
      validationAction: 'error',
    });
    console.log('[Schema] consultations_v2 검증 적용 완료');
  } catch (e: any) {
    if (e.code !== 26) console.warn('[Schema] consultations_v2 검증 적용 실패:', e.message);
  }

  // 4. callbacks_v2
  try {
    await db.command({
      collMod: 'callbacks_v2',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['patientId', 'type', 'status', 'scheduledAt'],
          properties: {
            patientId: { bsonType: 'string', description: '환자 ID (필수)' },
            type: {
              enum: ['callback', 'recall', 'thanks'],
              description: '콜백 유형',
            },
            status: {
              enum: ['pending', 'completed', 'missed'],
              description: '콜백 상태',
            },
            clinicId: { bsonType: 'string', description: '클리닉 ID' },
          },
        },
      },
      validationLevel: 'moderate',
      validationAction: 'error',
    });
    console.log('[Schema] callbacks_v2 검증 적용 완료');
  } catch (e: any) {
    if (e.code !== 26) console.warn('[Schema] callbacks_v2 검증 적용 실패:', e.message);
  }

  console.log('[Schema] V2 스키마 검증 적용 완료');
}
