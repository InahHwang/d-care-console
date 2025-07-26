// src/app/api/debug/age-analysis/route.ts
import { NextResponse } from 'next/server';
import { analyzeAgeField, checkCollectionValidation } from '@/utils/mongodb';

export async function GET() {
  try {
    const ageAnalysis = await analyzeAgeField();
    const validationRules = await checkCollectionValidation();
    
    return NextResponse.json({
      ageAnalysis,
      validationRules,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // TypeScript 에러 해결: unknown 타입 처리
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('❌ Age analysis debug API error:', error);
    
    return NextResponse.json({ 
      error: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}