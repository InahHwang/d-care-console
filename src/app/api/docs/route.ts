// src/app/api/docs/route.ts
// OpenAPI JSON 스펙 서빙

import { NextResponse } from 'next/server';
import spec from './openapi.json';

export async function GET() {
  return NextResponse.json(spec);
}
