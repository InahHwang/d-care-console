// src/app/api/admin/environment/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const envInfo = {
    environment: process.env.NODE_ENV || 'development',
    database: `d-care-${process.env.NODE_ENV === 'production' ? 'production' : 'development'}`,
    isProduction: process.env.NODE_ENV === 'production'
  };
  
  return NextResponse.json(envInfo);
}