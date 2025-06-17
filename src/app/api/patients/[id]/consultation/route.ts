// src/app/api/patients/[id]/consultation/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '@/utils/mongodb'
import { ConsultationInfo } from '@/types/patient'

// 상담/결제 정보 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { db } = await connectToDatabase()
    const patientsCollection = db.collection('patients')
    
    // 환자 조회
    const patient = await patientsCollection.findOne({ 
      _id: new ObjectId(params.id) 
    })
    
    if (!patient) {
      return NextResponse.json(
        { error: '환자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      consultation: patient.consultation || null
    })
    
  } catch (error) {
    console.error('상담 정보 조회 오류:', error)
    return NextResponse.json(
      { error: '상담 정보 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 상담/결제 정보 생성/수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const consultationData: Partial<ConsultationInfo> = await request.json()
    
    // 기본 유효성 검사
    if (consultationData.estimatedAmount !== undefined && consultationData.estimatedAmount < 0) {
      return NextResponse.json(
        { error: '견적 금액은 0 이상이어야 합니다.' },
        { status: 400 }
      )
    }
    
    const { db } = await connectToDatabase()
    const patientsCollection = db.collection('patients')
    
    // 현재 환자 정보 조회
    const existingPatient = await patientsCollection.findOne({ 
      _id: new ObjectId(params.id) 
    })
    
    if (!existingPatient) {
      return NextResponse.json(
        { error: '환자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }
    
    // 기존 상담 정보와 새 정보 병합
    const updatedConsultation = {
      ...existingPatient.consultation,
      ...consultationData,
      updatedAt: new Date().toISOString()
    }
    
    // 환자 정보 업데이트
    const result = await patientsCollection.updateOne(
      { _id: new ObjectId(params.id) },
      { 
        $set: { 
          consultation: updatedConsultation,
          lastModifiedAt: new Date().toISOString()
        }
      }
    )
    
    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: '환자 정보 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }
    
    // 업데이트된 환자 정보 조회
    const updatedPatient = await patientsCollection.findOne({ 
      _id: new ObjectId(params.id) 
    })
    
    return NextResponse.json({
      success: true,
      consultation: updatedPatient?.consultation,
      patient: updatedPatient
    })
    
  } catch (error) {
    console.error('상담 정보 업데이트 오류:', error)
    return NextResponse.json(
      { error: '상담 정보 업데이트에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 상담/결제 정보 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { db } = await connectToDatabase()
    const patientsCollection = db.collection('patients')
    
    // 상담 정보 삭제
    const result = await patientsCollection.updateOne(
      { _id: new ObjectId(params.id) },
      { 
        $unset: { consultation: "" },
        $set: { lastModifiedAt: new Date().toISOString() }
      }
    )
    
    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: '환자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: '상담 정보가 삭제되었습니다.'
    })
    
  } catch (error) {
    console.error('상담 정보 삭제 오류:', error)
    return NextResponse.json(
      { error: '상담 정보 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}