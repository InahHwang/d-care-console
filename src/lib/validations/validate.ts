import { ZodSchema } from 'zod';
import { NextResponse } from 'next/server';

export function validateBody<T>(schema: ZodSchema<T>, body: unknown):
  { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const errors = result.error.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.', details: errors },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: result.data };
}
