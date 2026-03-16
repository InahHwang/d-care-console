// src/app/api/v2/templates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { MessageTemplate } from '@/types/messageLog';

// GET: 템플릿 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('templates');

    const templates = await collection
      .find({})
      .sort({ updatedAt: -1 })
      .toArray();

    const formattedTemplates = templates.map((template: any) => ({
      ...template,
      _id: undefined,
      id: template.id || template._id.toString(),
    }));

    return NextResponse.json({
      success: true,
      data: formattedTemplates,
      message: `템플릿 ${formattedTemplates.length}개를 조회했습니다.`
    });
  } catch (error) {
    console.error('템플릿 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: 새 템플릿 추가
export async function POST(request: NextRequest) {
  try {
    const templateData: MessageTemplate = await request.json();

    if (!templateData.title || !templateData.content) {
      return NextResponse.json(
        { success: false, message: '템플릿 제목과 내용은 필수입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const collection = db.collection('templates');

    const newTemplate: MessageTemplate = {
      ...templateData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: templateData.createdBy || 'system'
    };

    const existingTemplate = await collection.findOne({ id: newTemplate.id });
    if (existingTemplate) {
      return NextResponse.json(
        { success: false, message: '이미 존재하는 템플릿 ID입니다.' },
        { status: 409 }
      );
    }

    await collection.insertOne(newTemplate);

    return NextResponse.json({
      success: true,
      data: newTemplate,
      message: '템플릿이 성공적으로 추가되었습니다.'
    });
  } catch (error) {
    console.error('템플릿 추가 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: 템플릿 수정
export async function PUT(request: NextRequest) {
  try {
    const templateData: MessageTemplate = await request.json();

    if (!templateData.id || !templateData.title || !templateData.content) {
      return NextResponse.json(
        { success: false, message: '템플릿 ID, 제목, 내용은 필수입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const collection = db.collection('templates');

    const updatedTemplate: MessageTemplate = {
      ...templateData,
      updatedAt: new Date().toISOString()
    };

    const result = await collection.updateOne(
      { id: templateData.id },
      { $set: updatedTemplate }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, message: '수정할 템플릿을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedTemplate,
      message: '템플릿이 성공적으로 수정되었습니다.'
    });
  } catch (error) {
    console.error('템플릿 수정 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: 템플릿 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');

    if (!templateId) {
      return NextResponse.json(
        { success: false, message: '삭제할 템플릿 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const collection = db.collection('templates');

    const result = await collection.deleteOne({ id: templateId });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, message: '삭제할 템플릿을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { id: templateId },
      message: '템플릿이 성공적으로 삭제되었습니다.'
    });
  } catch (error) {
    console.error('템플릿 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
