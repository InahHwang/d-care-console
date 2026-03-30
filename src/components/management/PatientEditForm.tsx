// src/components/management/PatientEditForm.tsx - 실시간 데이터 동기화 추가

'use client'

import { useState, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RootState } from '@/store'
import { updatePatient, PatientStatus, Patient, setSelectedPatient } from '@/store/slices/patientsSlice'
import { HiOutlineX, HiOutlineUser, HiOutlinePhone, HiOutlineCalendar, HiOutlineLocationMarker, HiOutlineCake, HiOutlineGlobeAlt } from 'react-icons/hi'
import { FiPhoneCall } from 'react-icons/fi'
import { Icon } from '../common/Icon'
import { provinces, getCitiesByProvince } from '@/constants/regionData'
import { useActivityLogger } from '@/hooks/useActivityLogger'
// 🔥 데이터 동기화 유틸리티 import 추가
import { PatientDataSync } from '@/utils/dataSync'
// 🔥 커스텀 카테고리 훅 import
import { useCategories } from '@/hooks/useCategories'

// 환자 상태 옵션
const statusOptions = [
  { value: '잠재고객', label: '잠재고객' },
  { value: '콜백필요', label: '콜백필요' },
  { value: '부재중', label: '부재중' },
  { value: '활성고객', label: '활성고객' },
  { value: 'VIP', label: 'VIP' },
  { value: '예약확정', label: '예약확정' },
  { value: '재예약확정', label: '재예약확정' },
  { value: '종결', label: '종결' },
]

interface PatientEditFormProps {
  patient: Patient
  isOpen: boolean
  onClose: () => void
}

export default function PatientEditForm({ patient, isOpen, onClose }: PatientEditFormProps) {
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const currentUser = useAppSelector((state: RootState) => state.auth.user)
  const isLoading = useAppSelector((state: RootState) => state.patients.isLoading)

  // 🔥 활동 로깅 훅 추가
  const { logPatientAction } = useActivityLogger()

  // 🔥 커스텀 카테고리 데이터 가져오기
  const {
    consultationTypeOptions,
    referralSourceOptions,
    interestedServiceOptions,
    isLoading: categoriesLoading
  } = useCategories()

  // 🚀 Optimistic Update 활성화
  const isOptimisticEnabled = true
  
  // 🔥 폼 상태 관리 - 기존 patient 데이터로 초기화
  const [formValues, setFormValues] = useState({
    name: patient.name || '',
    phoneNumber: patient.phoneNumber || '',
    status: (patient.status || '잠재고객') as PatientStatus,
    interestedServices: patient.interestedServices || [],
    memo: patient.memo || '',
    callInDate: patient.callInDate || '',
    age: patient.age,
    region: patient.region,
    consultationType: patient.consultationType || 'outbound',
    referralSource: patient.referralSource || '',
  })
  
  // 지역 선택 상태
  const [selectedProvince, setSelectedProvince] = useState(patient.region?.province || '')
  const [availableCities, setAvailableCities] = useState<string[]>([])
  const [selectedCity, setSelectedCity] = useState(patient.region?.city || '')
  
  // 🔥 전화번호 중복 체크 상태 (기존 환자 제외)
  const [phoneCheckStatus, setPhoneCheckStatus] = useState<{
    isChecking: boolean;
    isDuplicate: boolean;
    existingPatient: any | null;
    message: string;
  }>({
    isChecking: false,
    isDuplicate: false,
    existingPatient: null,
    message: ''
  })
  
  // 유효성 검사 상태
  const [errors, setErrors] = useState({
    name: '',
    phoneNumber: '',
    age: '',
    callInDate: '',
  })

  // 🔥 수정 전 데이터 정리 함수
  const prepareUpdateDataForSubmit = (formData: any): any => {
    const preparedData = { ...formData };
    
    // 🔥 나이가 undefined인 경우 필드 제거
    if (preparedData.age === undefined) {
      delete preparedData.age;
      console.log('🔥 환자 수정: 나이 필드 제거 (undefined)');
    }
    
    // 🔥 지역이 비어있는 경우 필드 제거
    if (!preparedData.region || !preparedData.region.province) {
      delete preparedData.region;
      console.log('🔥 환자 수정: 지역 필드 제거 (미선택)');
    }
    
    return preparedData;
  };
  
  // 🔥 전화번호 중복 체크 함수 (현재 환자 제외)
  const checkPhoneNumber = async (phoneNumber: string) => {
    if (!phoneNumber || phoneNumber.length < 13 || phoneNumber === patient.phoneNumber) {
      setPhoneCheckStatus({
        isChecking: false,
        isDuplicate: false,
        existingPatient: null,
        message: ''
      })
      return
    }

    setPhoneCheckStatus(prev => ({ ...prev, isChecking: true, message: '' }))

    try {
      const response = await fetch('/api/patients/check-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          phoneNumber,
          excludePatientId: patient._id || patient.id // 현재 환자 제외
        }),
      })

      const data = await response.json()

      if (data.exists) {
        setPhoneCheckStatus({
          isChecking: false,
          isDuplicate: true,
          existingPatient: data.patient,
          message: `이미 등록된 전화번호입니다. (${data.patient.name}님, ${data.patient.patientId})`
        })
      } else {
        setPhoneCheckStatus({
          isChecking: false,
          isDuplicate: false,
          existingPatient: null,
          message: '사용 가능한 전화번호입니다.'
        })
      }
    } catch (error) {
      console.error('전화번호 체크 오류:', error)
      setPhoneCheckStatus({
        isChecking: false,
        isDuplicate: false,
        existingPatient: null,
        message: '전화번호 확인 중 오류가 발생했습니다.'
      })
    }
  }

  // 🔥 전화번호 입력 시 실시간 체크 (디바운싱 적용)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formValues.phoneNumber && formValues.phoneNumber !== patient.phoneNumber) {
        checkPhoneNumber(formValues.phoneNumber)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [formValues.phoneNumber, patient.phoneNumber])
  
  // 🚀 Optimistic Update를 위한 React Query Mutation
  const optimisticUpdateMutation = useMutation({
    mutationFn: async (updateData: any) => {
      // Redux 액션을 Promise로 감싸기
      return dispatch(updatePatient({
        patientId: patient._id || patient.id,
        patientData: updateData
      })).unwrap()
    },
    onMutate: async (updateData) => {
      // 🚀 1. 기존 쿼리 취소 (충돌 방지)
      await queryClient.cancelQueries({ queryKey: ['patients'] })

      // 🚀 2. 현재 데이터 백업
      const previousPatients = queryClient.getQueryData(['patients'])
      const previousSelectedPatient = patient

      // 🚀 3. UI에 즉시 반영 - React Query 캐시
      queryClient.setQueryData(['patients'], (oldData: any) => {
        if (!oldData) return oldData

        // 🚨 데이터 구조 처리
        if (oldData.patients && Array.isArray(oldData.patients)) {
          return {
            ...oldData,
            patients: oldData.patients.map((p: any) =>
              (p._id === patient._id || p.id === patient.id)
                ? { ...p, ...updateData, updatedAt: new Date().toISOString() }
                : p
            )
          }
        }

        if (Array.isArray(oldData)) {
          return oldData.map((p: any) =>
            (p._id === patient._id || p.id === patient.id)
              ? { ...p, ...updateData, updatedAt: new Date().toISOString() }
              : p
          )
        }

        return oldData
      })

      // 🚀 4. Redux selectedPatient도 즉시 업데이트 (환자 상세 모달 반영)
      const optimisticPatient = { ...patient, ...updateData, updatedAt: new Date().toISOString() }
      dispatch(setSelectedPatient(optimisticPatient))

      // 🚀 5. 즉시 모달 닫기 (서버 응답 기다리지 않음 - 진정한 Optimistic Update)
      handleClose()

      return { previousPatients, previousSelectedPatient, updateData, optimisticPatient }
    },
    onSuccess: (updatedPatient, variables, context) => {
      // 🚀 6. 서버 응답으로 최종 데이터 동기화 (백그라운드)
      dispatch(setSelectedPatient(updatedPatient))
      PatientDataSync.onUpdate(patient._id || patient.id, 'PatientEditForm', variables);

      // 🚀 7. 활동 로그는 백그라운드에서 처리
      logPatientAction(
        'patient_update',
        patient._id || patient.id,
        updatedPatient.name,
        {
          patientId: patient._id || patient.id,
          patientName: updatedPatient.name,
          changes: context?.updateData,
          handledBy: currentUser?.name,
          notes: `환자 정보 수정 완료`
        }
      ).catch(logError => {
        console.warn('⚠️ 활동 로그 기록 실패:', logError);
      });
    },
    onError: (error, variables, context) => {
      // 🚀 실패시 롤백 - React Query 캐시
      if (context?.previousPatients) {
        queryClient.setQueryData(['patients'], context.previousPatients)
      }

      // 🚀 실패시 롤백 - Redux selectedPatient
      if (context?.previousSelectedPatient) {
        dispatch(setSelectedPatient(context.previousSelectedPatient))
      }

      console.error('환자 수정 오류:', error)
      alert('환자 정보 수정에 실패했습니다. 다시 시도해주세요.')
    }
  })
  
  // 선택된 시/도가 변경되면 시/군/구 목록 업데이트
  useEffect(() => {
    if (selectedProvince) {
      setAvailableCities(getCitiesByProvince(selectedProvince))
      if (!getCitiesByProvince(selectedProvince).includes(selectedCity)) {
        setSelectedCity('')
      }
    } else {
      setAvailableCities([])
      setSelectedCity('')
    }
  }, [selectedProvince, selectedCity])
  
  // 지역 정보가 변경될 때 폼 데이터 업데이트
  useEffect(() => {
    if (selectedProvince) {
      setFormValues(prev => ({
        ...prev,
        region: {
          province: selectedProvince,
          city: selectedCity || undefined
        }
      }))
    } else {
      setFormValues(prev => ({
        ...prev,
        region: undefined
      }))
    }
  }, [selectedProvince, selectedCity])
  
  // 🔥 patient 데이터가 변경될 때 폼 초기화
  useEffect(() => {
    if (patient) {
      setFormValues({
        name: patient.name || '',
        phoneNumber: patient.phoneNumber || '',
        status: (patient.status || '잠재고객') as PatientStatus,
        interestedServices: patient.interestedServices || [],
        memo: patient.memo || '',
        callInDate: patient.callInDate || '',
        age: patient.age,
        region: patient.region,
        consultationType: patient.consultationType || 'outbound',
        referralSource: patient.referralSource || '',
      })
      setSelectedProvince(patient.region?.province || '')
      setSelectedCity(patient.region?.city || '')
    }
  }, [patient])
  
  // 모달 닫기
  const handleClose = () => {
    onClose()
    setErrors({
      name: '',
      phoneNumber: '',
      age: '',
      callInDate: '',
    })
    // 🔥 전화번호 체크 상태도 초기화
    setPhoneCheckStatus({
      isChecking: false,
      isDuplicate: false,
      existingPatient: null,
      message: ''
    })
  }
  
  // 🔥 입력값 변경 처리
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    // 🔥 나이 필드 처리 개선
    if (name === 'age') {
      let ageValue: number | undefined;
      
      if (value === '' || value.trim() === '') {
        ageValue = undefined;
        console.log('🔥 나이 필드: 빈 값으로 undefined 설정');
      } else {
        const parsedAge = parseInt(value, 10);
        ageValue = isNaN(parsedAge) ? undefined : parsedAge;
        console.log('🔥 나이 필드: 숫자 값 설정', { input: value, parsed: ageValue });
      }
      
      setFormValues(prev => ({
        ...prev,
        age: ageValue
      }))
    } else {
      setFormValues(prev => ({
        ...prev,
        [name]: value
      }))
    }
    
    // 오류 메시지 초기화
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }
  
  // 시/도 선택 처리
  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedProvince(e.target.value)
  }
  
  // 시/군/구 선택 처리
  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCity(e.target.value)
  }
  
  // 관심 분야 체크박스 처리
  const handleInterestChange = (service: string) => {
    setFormValues(prev => {
      const updatedServices = prev.interestedServices.includes(service)
        ? prev.interestedServices.filter(s => s !== service)
        : [...prev.interestedServices, service]
      
      return {
        ...prev,
        interestedServices: updatedServices
      }
    })
  }
  
  // 🚀 기존 방식 폼 제출 (fallback)
  const handleTraditionalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 🔥 로그인 사용자 확인
    if (!currentUser) {
      alert('로그인이 필요합니다.');
      return;
    }

    // 🔥 전화번호 중복 체크
    if (phoneCheckStatus.isDuplicate) {
      alert('이미 등록된 전화번호입니다. 다른 번호를 입력해주세요.');
      return;
    }
    
    // 유효성 검사
    let isValid = true
    const newErrors = { 
      name: '', 
      phoneNumber: '', 
      age: '',
      callInDate: '',
    }
    
    if (!formValues.name.trim()) {
      newErrors.name = '이름을 입력해주세요'
      isValid = false
    }
    
    if (!formValues.phoneNumber.trim()) {
      newErrors.phoneNumber = '연락처를 입력해주세요'
      isValid = false
    } else if (!/^[0-9]{3}-[0-9]{3,4}-[0-9]{4}$/.test(formValues.phoneNumber)) {
      newErrors.phoneNumber = '올바른 연락처 형식이 아닙니다. (예: 010-1234-5678)'
      isValid = false
    }
    
    if (formValues.age !== undefined && (formValues.age < 1 || formValues.age > 120)) {
      newErrors.age = '유효한 나이를 입력해주세요 (1-120)'
      isValid = false
    }
    
    if (!formValues.callInDate) {
      newErrors.callInDate = 'DB 유입 날짜를 입력해주세요'
      isValid = false
    }
    
    setErrors(newErrors)
    
    if (!isValid) return
    
    try {
      // 🔥 제출 데이터 정리
      const preparedData = prepareUpdateDataForSubmit(formValues);
      
      console.log('환자 정보 수정 데이터:', preparedData);
      
      // Redux 액션 디스패치
      const result = await dispatch(updatePatient({
        patientId: patient._id || patient.id,
        patientData: preparedData
      })).unwrap()
      
      // 🔥 환자 수정 성공 시 활동 로그 기록 + 데이터 동기화
      try {
        await logPatientAction(
          'patient_update',
          patient._id || patient.id,
          result.name,
          {
            patientId: patient._id || patient.id,
            patientName: result.name,
            changes: preparedData,
            handledBy: currentUser.name,
            notes: `환자 정보 수정 완료`
          }
        );
        console.log('✅ 환자 수정 활동 로그 기록 성공');
      } catch (logError) {
        console.warn('⚠️ 활동 로그 기록 실패:', logError);
      }
      
      // 🔥 즉시 데이터 동기화 트리거
      PatientDataSync.onUpdate(patient._id || patient.id, 'PatientEditForm_traditional', preparedData);
      
      // 성공 처리
      alert(`환자 정보가 수정되었습니다!\n수정자: ${currentUser.name}`)
      handleClose()
    } catch (error) {
      console.error('환자 수정 오류:', error)
      
      // 🔥 환자 수정 실패 시에도 로그 기록
      try {
        await logPatientAction(
          'patient_update',
          patient._id || patient.id,
          formValues.name,
          {
            patientId: patient._id || patient.id,
            patientName: formValues.name,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
            attemptedBy: currentUser.name,
            notes: '환자 정보 수정 실패'
          }
        );
      } catch (logError) {
        console.warn('활동 로그 기록 실패:', logError);
      }
      
      alert('환자 정보 수정 중 오류가 발생했습니다.')
    }
  }
  
  // 🚀 Optimistic 방식 폼 제출
  const handleOptimisticSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 로그인 사용자 확인
    if (!currentUser) {
      alert('로그인이 필요합니다.');
      return;
    }

    // 🔥 전화번호 중복 체크
    if (phoneCheckStatus.isDuplicate) {
      alert('이미 등록된 전화번호입니다. 다른 번호를 입력해주세요.');
      return;
    }
    
    // 유효성 검사 (동일)
    let isValid = true
    const newErrors = { 
      name: '', 
      phoneNumber: '', 
      age: '',
      callInDate: '',
    }
    
    if (!formValues.name.trim()) {
      newErrors.name = '이름을 입력해주세요'
      isValid = false
    }
    
    if (!formValues.phoneNumber.trim()) {
      newErrors.phoneNumber = '연락처를 입력해주세요'
      isValid = false
    } else if (!/^[0-9]{3}-[0-9]{3,4}-[0-9]{4}$/.test(formValues.phoneNumber)) {
      newErrors.phoneNumber = '올바른 연락처 형식이 아닙니다. (예: 010-1234-5678)'
      isValid = false
    }
    
    if (formValues.age !== undefined && (formValues.age < 1 || formValues.age > 120)) {
      newErrors.age = '유효한 나이를 입력해주세요 (1-120)'
      isValid = false
    }
    
    if (!formValues.callInDate) {
      newErrors.callInDate = 'DB 유입 날짜를 입력해주세요'
      isValid = false
    }
    
    setErrors(newErrors)
    
    if (!isValid) return
    
    // 🔥 환자 데이터 준비 및 정리
    const preparedData = prepareUpdateDataForSubmit(formValues);
    
    console.log('🚀 Optimistic: 정리된 환자 수정 데이터:', preparedData);
    
    // 🚀 Optimistic Update 실행
    optimisticUpdateMutation.mutate(preparedData)
  }
  
  // 전화번호 자동 포맷팅
  const formatPhoneNumber = (value: string) => {
    // 숫자만 추출
    const numbers = value.replace(/[^\d]/g, '')
    
    // 포맷팅
    if (numbers.length <= 3) {
      return numbers
    } else if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
    } else {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
    }
  }
  
  // 전화번호 입력 처리
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
    const formattedValue = formatPhoneNumber(value)
    setFormValues(prev => ({
      ...prev,
      phoneNumber: formattedValue
    }))
    
    // 오류 메시지 초기화
    if (errors.phoneNumber) {
      setErrors(prev => ({
        ...prev,
        phoneNumber: ''
      }))
    }
  }
  
  // 🚀 환경변수에 따라 제출 방식 선택
  const handleSubmit = isOptimisticEnabled ? handleOptimisticSubmit : handleTraditionalSubmit
  const currentIsLoading = isOptimisticEnabled ? optimisticUpdateMutation.isPending : isLoading
  
  // 모달이 닫혀 있을 때는 렌더링하지 않음
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-auto">
        {/* 모달 헤더 */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">환자 정보 수정</h2>
            <p className="text-sm text-text-secondary mt-1">
              환자번호: {patient.patientId}
            </p>
            {/* 🔥 수정자 정보 표시 */}
            {currentUser && (
              <p className="text-sm text-text-secondary mt-1">
                수정자: {currentUser.name} ({currentUser.role === 'master' ? '마스터' : '직원'})
              </p>
            )}
            {/* 🚀 개발 모드에서 현재 방식 표시 */}
            {process.env.NODE_ENV === 'development' && (
              <p className="text-xs text-gray-500 mt-1">
                {isOptimisticEnabled ? '🚀 Optimistic Update + 실시간 동기화' : '🐌 기존 방식'}
              </p>
            )}
          </div>
          <button 
            className="text-text-secondary hover:text-text-primary" 
            onClick={handleClose}
            disabled={currentIsLoading}
          >
            <Icon icon={HiOutlineX} size={20} />
          </button>
        </div>
        
        {/* 모달 바디 */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-5">
            {/* 🔥 상담 타입 선택 필드 - 커스텀 카테고리 사용 */}
            <div>
              <label htmlFor="consultationType" className="block text-sm font-medium text-text-primary mb-1">
                상담 타입
              </label>
              <div className="relative">
                <select
                  id="consultationType"
                  name="consultationType"
                  value={formValues.consultationType || 'outbound'}
                  onChange={handleChange}
                  className="form-input pl-10 appearance-none"
                  disabled={categoriesLoading}
                >
                  {consultationTypeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                  <Icon icon={FiPhoneCall} size={18} />
                </span>
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                  ▼
                </span>
              </div>
            </div>
            
            {/* 이름 */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-text-primary mb-1">
                환자명 <span className="text-error">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formValues.name}
                  onChange={handleChange}
                  className={`form-input pl-10 ${errors.name ? 'border-error' : ''}`}
                  placeholder="홍길동"
                />
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                  <Icon icon={HiOutlineUser} size={18} />
                </span>
              </div>
              {errors.name && (
                <p className="mt-1 text-sm text-error">{errors.name}</p>
              )}
            </div>
            
            {/* 🔥 연락처 - 중복 체크 기능 (현재 환자 제외) */}
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-text-primary mb-1">
                연락처 <span className="text-error">*</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  value={formValues.phoneNumber}
                  onChange={handlePhoneChange}
                  className={`form-input pl-10 pr-10 ${
                    errors.phoneNumber ? 'border-error' : 
                    phoneCheckStatus.isDuplicate ? 'border-red-500' :
                    phoneCheckStatus.message && !phoneCheckStatus.isDuplicate ? 'border-green-500' : ''
                  }`}
                  placeholder="010-1234-5678"
                />
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                  <Icon icon={HiOutlinePhone} size={18} />
                </span>
                {/* 🔥 중복 체크 상태 표시 */}
                {phoneCheckStatus.isChecking && (
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                  </span>
                )}
                {!phoneCheckStatus.isChecking && phoneCheckStatus.message && (
                  <span className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
                    phoneCheckStatus.isDuplicate ? 'text-red-500' : 'text-green-500'
                  }`}>
                    {phoneCheckStatus.isDuplicate ? '❌' : '✅'}
                  </span>
                )}
              </div>
              {errors.phoneNumber && (
                <p className="mt-1 text-sm text-error">{errors.phoneNumber}</p>
              )}
              {/* 🔥 전화번호 중복 체크 메시지 */}
              {phoneCheckStatus.message && (
                <div className={`mt-2 p-2 rounded-md flex items-center gap-2 text-sm ${
                  phoneCheckStatus.isDuplicate 
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  <Icon icon={HiOutlinePhone} size={16} />
                  <span>{phoneCheckStatus.message}</span>
                </div>
              )}
            </div>
            
            {/* 나이 */}
            <div>
              <label htmlFor="age" className="block text-sm font-medium text-text-primary mb-1">
                나이
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="age"
                  name="age"
                  min={1}
                  max={120}
                  value={formValues.age !== undefined ? formValues.age : ''}
                  onChange={handleChange}
                  className={`form-input pl-10 ${errors.age ? 'border-error' : ''}`}
                  placeholder="30"
                />
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                  <Icon icon={HiOutlineCake} size={18} />
                </span>
              </div>
              {errors.age && (
                <p className="mt-1 text-sm text-error">{errors.age}</p>
              )}
            </div>
            
            {/* 거주지역 - 시/도 및 시/군/구 */}
            <div>
              <label htmlFor="region" className="block text-sm font-medium text-text-primary mb-1">
                거주지역
              </label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 시/도 선택 */}
                <div className="relative">
                  <select
                    id="province"
                    value={selectedProvince}
                    onChange={handleProvinceChange}
                    className="form-input pl-10 appearance-none"
                  >
                    <option value="">시/도 선택</option>
                    {provinces.map(province => (
                      <option key={province} value={province}>
                        {province}
                      </option>
                    ))}
                  </select>
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                    <Icon icon={HiOutlineLocationMarker} size={18} />
                  </span>
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                    ▼
                  </span>
                </div>
                
                {/* 시/군/구 선택 */}
                <div className="relative">
                  <select
                    id="city"
                    value={selectedCity}
                    onChange={handleCityChange}
                    className="form-input pl-2 appearance-none"
                    disabled={!selectedProvince}
                  >
                    <option value="">시/군/구 선택</option>
                    {availableCities.map(city => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                    ▼
                  </span>
                </div>
              </div>
            </div>
            
            {/* 🔥 유입경로 필드 - 커스텀 카테고리 사용 */}
            <div>
              <label htmlFor="referralSource" className="block text-sm font-medium text-text-primary mb-1">
                유입경로
              </label>
              <div className="relative">
                <select
                  id="referralSource"
                  name="referralSource"
                  value={formValues.referralSource}
                  onChange={handleChange}
                  className="form-input pl-10 appearance-none"
                  disabled={categoriesLoading}
                >
                  {referralSourceOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                  <Icon icon={HiOutlineGlobeAlt} size={18} />
                </span>
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                  ▼
                </span>
              </div>
            </div>
            
            {/* DB 유입 날짜 */}
            <div>
              <label htmlFor="callInDate" className="block text-sm font-medium text-text-primary mb-1">
                DB 유입 날짜 <span className="text-error">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  id="callInDate"
                  name="callInDate"
                  value={formValues.callInDate}
                  onChange={handleChange}
                  className={`form-input pl-10 ${errors.callInDate ? 'border-error' : ''}`}
                />
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                  <Icon icon={HiOutlineCalendar} size={18} />
                </span>
              </div>
              {errors.callInDate && (
                <p className="mt-1 text-sm text-error">{errors.callInDate}</p>
              )}
            </div>            
            
            {/* 관심 분야 - 커스텀 카테고리 사용 */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                관심 분야
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {interestedServiceOptions.map(option => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formValues.interestedServices.includes(option.label)}
                      onChange={() => handleInterestChange(option.label)}
                      className="w-4 h-4 accent-primary"
                      disabled={categoriesLoading}
                    />
                    <span className="text-sm text-text-secondary">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          
          {/* 버튼 영역 */}
          <div className="mt-8 flex justify-end gap-3">
            <button 
              type="button" 
              className="btn btn-outline"
              onClick={handleClose}
              disabled={currentIsLoading}
            >
              취소
            </button>
            <button 
              type="submit" 
              className={`btn btn-primary ${
                phoneCheckStatus.isDuplicate || phoneCheckStatus.isChecking ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={
                currentIsLoading || 
                !currentUser || 
                phoneCheckStatus.isDuplicate || 
                phoneCheckStatus.isChecking
              }
            >
              {currentIsLoading ? '처리 중...' : '수정하기'}
            </button>
          </div>
          
          {/* 🔥 로그인 안된 경우 안내 메시지 */}
          {!currentUser && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-700">
                환자 정보 수정을 위해서는 로그인이 필요합니다.
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}