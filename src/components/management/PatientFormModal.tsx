//src/components/management/PatientFormModal.tsx

'use client'

import { useState, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RootState } from '@/store'
import { closePatientForm } from '@/store/slices/uiSlice'
import { createPatient, CreatePatientData, PatientStatus } from '@/store/slices/patientsSlice'
import { HiOutlineX, HiOutlineUser, HiOutlinePhone, HiOutlineCalendar, HiOutlineStar, HiOutlineLocationMarker, HiOutlineCake, HiOutlineGlobeAlt, HiOutlineExclamation } from 'react-icons/hi'
import { FiPhoneCall } from 'react-icons/fi'
import { Icon } from '../common/Icon'
import { provinces, getCitiesByProvince } from '@/constants/regionData'
import { useActivityLogger } from '@/hooks/useActivityLogger'
// 🔥 데이터 동기화 유틸리티 import 추가
import { PatientDataSync } from '@/utils/dataSync'

// 관심 분야 옵션
const interestAreaOptions = [
  { value: '단일 임플란트', label: '단일 임플란트' },
  { value: '다수 임플란트', label: '다수 임플란트' },
  { value: '무치악 임플란트', label: '무치악 임플란트' },
  { value: '틀니', label: '틀니' },
  { value: '라미네이트', label: '라미네이트' },
  { value: '충치치료', label: '충치치료' },
  { value: '기타', label: '기타' },
]

// 🔥 유입경로 옵션 추가
const referralSourceOptions = [
  { value: '', label: '선택 안함' },
  { value: '유튜브', label: '유튜브' },
  { value: '블로그', label: '블로그' },
  { value: '홈페이지', label: '홈페이지' },
  { value: '소개환자', label: '소개환자' },
  { value: '제휴', label: '제휴' },
  { value: '기타', label: '기타' },
]

export default function PatientFormModal() {
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const isOpen = useAppSelector((state: RootState) => state.ui.isPatientFormOpen)
  const isLoading = useAppSelector((state: RootState) => state.patients.isLoading)
  
  // 🔥 현재 로그인한 사용자 정보 가져오기
  const currentUser = useAppSelector((state: RootState) => state.auth.user)
  
  // 🔥 활동 로깅 훅 추가
  const { logPatientAction } = useActivityLogger()
  
  // 🚀 Optimistic Update 활성화
  const isOptimisticEnabled = true // Vercel 배포용 설정
  
  // 현재 날짜 설정
  const today = new Date().toISOString().split('T')[0]
  
  // 🔥 폼 상태 관리 - consultationType, referralSource 필드 추가
  const [formValues, setFormValues] = useState<CreatePatientData>({
    name: '',
    phoneNumber: '',
    status: '잠재고객' as PatientStatus, // 기본값 설정
    interestedServices: [],
    memo: '',
    callInDate: today, // 기본값으로 오늘 날짜 설정
    age: undefined,
    region: undefined,
    consultationType: 'outbound', // 🔥 기본값으로 아웃바운드 설정 (신규 환자 등록은 주로 아웃바운드)
    referralSource: '', // 🔥 유입경로 기본값
  })
  
  // 지역 선택 상태
  const [selectedProvince, setSelectedProvince] = useState('')
  const [availableCities, setAvailableCities] = useState<string[]>([])
  const [selectedCity, setSelectedCity] = useState('')
  
  // 🔥 전화번호 중복 체크 상태 추가
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

  // 🔥 폼 제출 전 데이터 정리 함수 - 컴포넌트 레벨로 이동
  const prepareCreateDataForSubmit = (formData: CreatePatientData): CreatePatientData => {
    const preparedData = { ...formData };
    
    // 🔥 나이가 undefined인 경우 필드 제거 (DB에 저장되지 않음)
    if (preparedData.age === undefined) {
      delete preparedData.age;
      console.log('🔥 신규 등록: 나이 필드 제거 (undefined)');
    }
    
    // 🔥 지역이 비어있는 경우 필드 제거
    if (!preparedData.region || !preparedData.region.province) {
      delete preparedData.region;
      console.log('🔥 신규 등록: 지역 필드 제거 (미선택)');
    }
    
    return preparedData;
  };
  
  // 🔥 전화번호 중복 체크 함수
  const checkPhoneNumber = async (phoneNumber: string) => {
    if (!phoneNumber || phoneNumber.length < 13) { // 010-1234-5678 최소 길이
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
        body: JSON.stringify({ phoneNumber }),
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
      if (formValues.phoneNumber) {
        checkPhoneNumber(formValues.phoneNumber)
      }
    }, 500) // 0.5초 지연

    return () => clearTimeout(timeoutId)
  }, [formValues.phoneNumber])
  
  // 🚀 Optimistic Update를 위한 React Query Mutation
  const optimisticCreateMutation = useMutation({
    mutationFn: async (data: CreatePatientData) => {
      // Redux 액션을 Promise로 감싸기
      return dispatch(createPatient(data)).unwrap()
    },
    onMutate: async (newPatientData) => {
      // 🚀 1. 기존 쿼리 취소 (충돌 방지)
      await queryClient.cancelQueries({ queryKey: ['patients'] })
      
      // 🚀 2. 현재 데이터 백업
      const previousPatients = queryClient.getQueryData(['patients'])
      
      // 🚀 3. 임시 ID 생성하여 UI 즉시 업데이트
      const tempPatient = {
        id: `temp_${Date.now()}`,
        _id: `temp_${Date.now()}`,
        patientId: `TEMP-${Date.now()}`,
        ...newPatientData,
        status: '잠재고객' as PatientStatus,
        consultationType: newPatientData.consultationType || 'outbound',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        consultantId: currentUser?.id || '',
        consultantName: currentUser?.name || '',
        isTemporary: true // 임시 데이터 표시
      }
      
      // 🚀 4. UI에 임시 환자 추가
      queryClient.setQueryData(['patients'], (oldData: any) => {
        if (!oldData) {
          return { patients: [tempPatient], totalItems: 1 }
        }
        
        // 🚨 데이터 구조 처리: { patients: [...] } 형태
        if (oldData.patients && Array.isArray(oldData.patients)) {
          return {
            ...oldData,
            patients: [tempPatient, ...oldData.patients],
            totalItems: (oldData.totalItems || oldData.patients.length) + 1
          }
        }
        
        // 배열 형태인 경우
        if (Array.isArray(oldData)) {
          return [tempPatient, ...oldData]
        }
        
        return oldData
      })
      
      // 🚀 5. 즉시 성공 메시지 표시
      alert(`신규 환자가 등록되었습니다!\n등록자: ${currentUser?.name}`)
      handleClose()
      
      return { previousPatients, tempPatient }
    },
    onSuccess: async (realPatient, variables, context) => {
      // 🚀 6. 서버에서 실제 데이터 받아서 임시 데이터 교체
      queryClient.setQueryData(['patients'], (oldData: any) => {
        if (!oldData) return { patients: [realPatient], totalItems: 1 }
        
        // 🚨 데이터 구조 처리
        if (oldData.patients && Array.isArray(oldData.patients)) {
          return {
            ...oldData,
            patients: oldData.patients.map((patient: any) => 
              patient.id === context?.tempPatient.id ? realPatient : patient
            )
          }
        }
        
        if (Array.isArray(oldData)) {
          return oldData.map((patient: any) => 
            patient.id === context?.tempPatient.id ? realPatient : patient
          )
        }
        
        return oldData
      })
      
      // 🔥 즉시 데이터 동기화 트리거
      PatientDataSync.onCreate(realPatient.id, 'PatientFormModal');
      
      // 🚀 7. 활동 로그 기록
      try {
        await logPatientAction(
          'patient_create',
          realPatient.id,
          realPatient.name,
          {
            patientId: realPatient.id,
            patientName: realPatient.name,
            phoneNumber: realPatient.phoneNumber,
            age: realPatient.age,
            status: realPatient.status,
            consultationType: realPatient.consultationType,
            referralSource: realPatient.referralSource,
            interestedServices: realPatient.interestedServices,
            region: realPatient.region,
            callInDate: realPatient.callInDate,
            handledBy: currentUser?.name,
            notes: `신규 환자 등록 완료`
          }
        );
        console.log('✅ 환자 등록 활동 로그 기록 성공');
      } catch (logError) {
        console.warn('⚠️ 활동 로그 기록 실패:', logError);
      }
    },
    onError: async (error, variables, context) => {
      // 🚀 8. 실패시 롤백
      if (context?.previousPatients) {
        queryClient.setQueryData(['patients'], context.previousPatients)
      }
      
      console.error('환자 등록 오류:', error)
      alert('환자 등록 중 오류가 발생했습니다.')
      
      // 실패 로그 기록
      try {
        await logPatientAction(
          'patient_create',
          'failed',
          variables.name,
          {
            patientName: variables.name,
            phoneNumber: variables.phoneNumber,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
            attemptedBy: currentUser?.name,
            notes: '신규 환자 등록 실패'
          }
        );
      } catch (logError) {
        console.warn('활동 로그 기록 실패:', logError);
      }
    },
    onSettled: () => {
      // 🚀 9. 최종적으로 서버 데이터로 동기화
      queryClient.invalidateQueries({ queryKey: ['patients'] })
    }
  })
  
  // 선택된 시/도가 변경되면 시/군/구 목록 업데이트
  useEffect(() => {
    if (selectedProvince) {
      setAvailableCities(getCitiesByProvince(selectedProvince))
      setSelectedCity('')
    } else {
      setAvailableCities([])
      setSelectedCity('')
    }
  }, [selectedProvince])
  
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
  
  // 모달 닫기
  const handleClose = () => {
    dispatch(closePatientForm())
    // 🔥 폼 상태 초기화 - consultationType, referralSource 포함
    setFormValues({
      name: '',
      phoneNumber: '',
      status: '잠재고객' as PatientStatus,
      interestedServices: [],
      memo: '',
      callInDate: today,      
      age: undefined,
      region: undefined,
      consultationType: 'outbound', // 🔥 초기화 시에도 포함
      referralSource: '', // 🔥 유입경로 초기화
    })
    setSelectedProvince('')
    setSelectedCity('')
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
  
  // 🔥 입력값 변경 처리 - prepareCreateDataForSubmit 함수 제거됨
  // 수정이 필요한 부분만 발췌

// 1. handleChange 함수 수정 (라인 약 268)
const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  const { name, value } = e.target
  
  // 🔥 나이 필드 처리 개선 - 빈 값을 명확하게 undefined로 설정
  if (name === 'age') {
    let ageValue: number | undefined;
    
    // 🔥 더 엄격한 검증 추가
    const trimmedValue = value.trim();
    
    if (trimmedValue === '') {
      // 빈 값인 경우 undefined로 설정 (DB에 저장하지 않음)
      ageValue = undefined;
      console.log('🔥 나이 필드: 빈 값으로 undefined 설정');
    } else {
      // 🔥 숫자만 포함되어 있는지 먼저 검증
      const isNumericOnly = /^\d+$/.test(trimmedValue);
      
      if (!isNumericOnly) {
        // 숫자가 아닌 문자가 포함된 경우 undefined로 설정
        ageValue = undefined;
        console.log('🔥 나이 필드: 유효하지 않은 입력으로 undefined 설정', { input: value });
      } else {
        // 순수 숫자인 경우에만 파싱
        const parsedAge = parseInt(trimmedValue, 10);
        
        // 🔥 추가 범위 검증
        if (parsedAge >= 1 && parsedAge <= 120) {
          ageValue = parsedAge;
          console.log('🔥 나이 필드: 유효한 숫자 값 설정', { input: value, parsed: ageValue });
        } else {
          // 범위를 벗어난 경우 undefined로 설정
          ageValue = undefined;
          console.log('🔥 나이 필드: 범위 초과로 undefined 설정', { input: value, parsed: parsedAge });
        }
      }
    }
      
      setFormValues(prev => ({
        ...prev,
        age: ageValue
      }))
    } else {
      // 🔥 일반 필드 처리 (callInDate 포함)
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
  
  // 🚀 기존 방식 폼 제출 (fallback) - 수정됨
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
      const preparedData = prepareCreateDataForSubmit({
        ...formValues,
        status: '잠재고객' as PatientStatus,
        consultationType: formValues.consultationType
      });
      
      console.log('신규 환자 등록 데이터:', preparedData);
      
      // Redux 액션 디스패치
      const result = await dispatch(createPatient(preparedData)).unwrap()
      
      // 🔥 환자 등록 성공 시 활동 로그 기록 + 데이터 동기화
      try {
        await logPatientAction(
          'patient_create',
          result.id,
          result.name,
          {
            patientId: result.id,
            patientName: result.name,
            phoneNumber: result.phoneNumber,
            age: result.age,
            status: result.status,
            consultationType: result.consultationType,
            referralSource: result.referralSource,
            interestedServices: result.interestedServices,
            region: result.region,
            callInDate: result.callInDate,
            handledBy: currentUser.name,
            notes: `신규 환자 등록 완료`
          }
        );
        console.log('✅ 환자 등록 활동 로그 기록 성공');
      } catch (logError) {
        console.warn('⚠️ 활동 로그 기록 실패:', logError);
      }
      
      // 🔥 즉시 데이터 동기화 트리거
      PatientDataSync.onCreate(result.id, 'PatientFormModal_traditional');
      
      // 성공 처리
      alert(`신규 환자가 등록되었습니다!\n등록자: ${currentUser.name}`)
      handleClose()
    } catch (error) {
      console.error('환자 등록 오류:', error)
      
      // 🔥 환자 등록 실패 시에도 로그 기록
      try {
        await logPatientAction(
          'patient_create',
          'failed',
          formValues.name,
          {
            patientName: formValues.name,
            phoneNumber: formValues.phoneNumber,
            error: error instanceof Error ? error.message : '알 수 없는 오류',
            attemptedBy: currentUser.name,
            notes: '신규 환자 등록 실패'
          }
        );
      } catch (logError) {
        console.warn('활동 로그 기록 실패:', logError);
      }
      
      alert('환자 등록 중 오류가 발생했습니다.')
    }
  }
  
  // 🚀 Optimistic 방식 폼 제출 - 수정됨
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
    const preparedData = prepareCreateDataForSubmit({
      ...formValues,
      status: '잠재고객' as PatientStatus,
      consultationType: formValues.consultationType
    });
    
    console.log('🚀 Optimistic: 정리된 환자 데이터:', preparedData);
    
    // 🚀 Optimistic Update 실행
    optimisticCreateMutation.mutate(preparedData)
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
  const currentIsLoading = isOptimisticEnabled ? optimisticCreateMutation.isPending : isLoading
  
  // 모달이 닫혀 있을 때는 렌더링하지 않음
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-auto">
        {/* 모달 헤더 */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">신규 환자 등록</h2>
            {/* 🔥 등록자 정보 표시 */}
            {currentUser && (
              <p className="text-sm text-text-secondary mt-1">
                등록자: {currentUser.name} ({currentUser.role === 'master' ? '마스터' : '직원'})
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
            {/* 🔥 상담 타입 선택 필드 추가 */}
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
                >
                  <option value="outbound">아웃바운드</option>
                  <option value="inbound">인바운드</option>
                  <option value="returning">구신환</option>
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
                  onChange={(e) => {
                    // 🔥 console.log 제거
                    setFormValues(prev => ({
                      ...prev,
                      name: e.target.value
                    }));
                    // 기존 에러 클리어
                    if (errors.name) {
                      setErrors(prev => ({
                        ...prev,
                        name: ''
                      }));
                    }
                  }}
                  // 🔥 onInput 이벤트도 제거
                  className={`form-input pl-10 ${errors.name ? 'border-error' : ''}`}
                  placeholder="홍길동"
                  autoComplete="name"
                />
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                  <Icon icon={HiOutlineUser} size={18} />
                </span>
              </div>
              {errors.name && (
                <p className="mt-1 text-sm text-error">{errors.name}</p>
              )}
            </div>
            
            {/* 🔥 연락처 - 중복 체크 기능 추가 */}
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
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
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
                  <Icon icon={phoneCheckStatus.isDuplicate ? HiOutlineExclamation : HiOutlinePhone} size={16} />
                  <span>{phoneCheckStatus.message}</span>
                </div>
              )}
              {/* 🔥 중복 환자 정보 표시 */}
              {phoneCheckStatus.isDuplicate && phoneCheckStatus.existingPatient && (
                <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
                  <p className="text-sm font-medium text-gray-800">기존 환자 정보:</p>
                  <div className="mt-1 text-xs text-gray-600 space-y-1">
                    <p>• 이름: {phoneCheckStatus.existingPatient.name}</p>
                    <p>• 환자번호: {phoneCheckStatus.existingPatient.patientId}</p>
                    <p>• 상태: {phoneCheckStatus.existingPatient.status}</p>
                    <p>• 상담타입: {phoneCheckStatus.existingPatient.consultationType === 'inbound' ? '인바운드' : '아웃바운드'}</p>
                    <p>• 등록일: {new Date(phoneCheckStatus.existingPatient.createdAt).toLocaleDateString()}</p>
                  </div>
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
            
            {/* 🔥 유입경로 필드 추가 */}
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
                  onChange={handleChange}  // 🔥 수정된 handleChange 사용
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
            
            {/* 관심 분야 */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                관심 분야
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {interestAreaOptions.map(option => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formValues.interestedServices.includes(option.value)}
                      onChange={() => handleInterestChange(option.value)}
                      className="w-4 h-4 accent-primary"
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
              {currentIsLoading ? '처리 중...' : '등록하기'}
            </button>
          </div>
          
          {/* 🔥 로그인 안된 경우 안내 메시지 */}
          {!currentUser && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-700">
                환자 등록을 위해서는 로그인이 필요합니다.
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}