// src/app/api/templates/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { MessageTemplate } from '@/types/messageLog';

// GET: 템플릿 목록 조회
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 템플릿 목록 조회 API 호출');
    
    const { db } = await connectToDatabase();
    const collection = db.collection('templates');
    
    // 최신 순으로 정렬하여 조회
    const templates = await collection
      .find({})
      .sort({ updatedAt: -1 })
      .toArray();
    
    // MongoDB의 _id를 문자열로 변환
    const formattedTemplates = templates.map((template: any) => ({
      ...template,
      _id: undefined, // MongoDB _id 제거
      id: template.id || template._id.toString(), // id 필드 사용 또는 _id를 id로 변환
    }));
    
    console.log(`✅ 템플릿 ${formattedTemplates.length}개 조회 완료`);
    
    return NextResponse.json({
      success: true,
      data: formattedTemplates,
      message: `템플릿 ${formattedTemplates.length}개를 조회했습니다.`
    });
    
  } catch (error: any) {
    console.error('❌ 템플릿 조회 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '템플릿 조회 중 오류가 발생했습니다: ' + error.message
      },
      { status: 500 }
    );
  }
}

// POST: 새 템플릿 추가
export async function POST(request: NextRequest) {
  try {
    console.log('➕ 새 템플릿 추가 API 호출');
    
    const templateData: MessageTemplate = await request.json();
    
    // 필수 필드 검증
    if (!templateData.title || !templateData.content) {
      return NextResponse.json(
        {
          success: false,
          message: '템플릿 제목과 내용은 필수입니다.'
        },
        { status: 400 }
      );
    }
    
    const { db } = await connectToDatabase();
    const collection = db.collection('templates');
    
    // 새 템플릿 데이터 준비
    const newTemplate: MessageTemplate = {
      ...templateData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: templateData.createdBy || 'system' // 추후 실제 사용자 ID로 변경
    };
    
    // 중복 ID 체크 (필요시)
    const existingTemplate = await collection.findOne({ id: newTemplate.id });
    if (existingTemplate) {
      return NextResponse.json(
        {
          success: false,
          message: '이미 존재하는 템플릿 ID입니다.'
        },
        { status: 409 }
      );
    }
    
    // 데이터베이스에 저장
    const result = await collection.insertOne(newTemplate);
    
    console.log('✅ 새 템플릿 추가 완료:', newTemplate.title);
    
    return NextResponse.json({
      success: true,
      data: newTemplate,
      message: '템플릿이 성공적으로 추가되었습니다.'
    });
    
  } catch (error: any) {
    console.error('❌ 템플릿 추가 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '템플릿 추가 중 오류가 발생했습니다: ' + error.message
      },
      { status: 500 }
    );
  }
}

// PUT: 템플릿 수정
export async function PUT(request: NextRequest) {
  try {
    console.log('✏️ 템플릿 수정 API 호출');
    
    const templateData: MessageTemplate = await request.json();
    
    // 필수 필드 검증
    if (!templateData.id || !templateData.title || !templateData.content) {
      return NextResponse.json(
        {
          success: false,
          message: '템플릿 ID, 제목, 내용은 필수입니다.'
        },
        { status: 400 }
      );
    }
    
    const { db } = await connectToDatabase();
    const collection = db.collection('templates');
    
    // 수정할 템플릿 데이터 준비
    const updatedTemplate: MessageTemplate = {
      ...templateData,
      updatedAt: new Date().toISOString()
    };
    
    // 데이터베이스에서 업데이트
    const result = await collection.updateOne(
      { id: templateData.id },
      { $set: updatedTemplate }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '수정할 템플릿을 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }
    
    console.log('✅ 템플릿 수정 완료:', updatedTemplate.title);
    
    return NextResponse.json({
      success: true,
      data: updatedTemplate,
      message: '템플릿이 성공적으로 수정되었습니다.'
    });
    
  } catch (error: any) {
    console.error('❌ 템플릿 수정 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '템플릿 수정 중 오류가 발생했습니다: ' + error.message
      },
      { status: 500 }
    );
  }
}

// DELETE: 템플릿 삭제
export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ 템플릿 삭제 API 호출');
    
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');
    
    if (!templateId) {
      return NextResponse.json(
        {
          success: false,
          message: '삭제할 템플릿 ID가 필요합니다.'
        },
        { status: 400 }
      );
    }
    
    const { db } = await connectToDatabase();
    const collection = db.collection('templates');
    
    // 데이터베이스에서 삭제
    const result = await collection.deleteOne({ id: templateId });
    
    if (result.deletedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '삭제할 템플릿을 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }
    
    console.log('✅ 템플릿 삭제 완료:', templateId);
    
    return NextResponse.json({
      success: true,
      data: { id: templateId },
      message: '템플릿이 성공적으로 삭제되었습니다.'
    });
    
  } catch (error: any) {
    console.error('❌ 템플릿 삭제 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '템플릿 삭제 중 오류가 발생했습니다: ' + error.message
      },
      { status: 500 }
    );
  }
}