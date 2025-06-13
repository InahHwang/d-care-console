//src/components/management/PatientFormModal.tsx

'use client'

import { useState, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks'
import { RootState } from '@/store'
import { closePatientForm } from '@/store/slices/uiSlice'
import { createPatient, CreatePatientData, PatientStatus } from '@/store/slices/patientsSlice'
import { HiOutlineX, HiOutlineUser, HiOutlinePhone, HiOutlineCalendar, HiOutlineStar, HiOutlineLocationMarker, HiOutlineCake, HiOutlineGlobeAlt } from 'react-icons/hi'
import { Icon } from '../common/Icon'
import { provinces, getCitiesByProvince } from '@/constants/regionData'
import { useActivityLogger } from '@/hooks/useActivityLogger' // 🔥 활동 로깅 훅 추가

// 관심 분야 옵션
const interestAreaOptions = [
  { value: '풀케이스', label: '풀케이스' },
  { value: '임플란트', label: '임플란트' },
  { value: '라미네이트', label: '라미네이트' },
  { value: '미백', label: '미백' },
  { value: '신경치료', label: '신경치료' },
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
  const isOpen = useAppSelector((state: RootState) => state.ui.isPatientFormOpen)
  const isLoading = useAppSelector((state: RootState) => state.patients.isLoading)
  
  // 🔥 현재 로그인한 사용자 정보 가져오기
  const currentUser = useAppSelector((state: RootState) => state.auth.user)
  
  // 🔥 활동 로깅 훅 추가
  const { logPatientAction } = useActivityLogger()
  
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
  
  // 유효성 검사 상태
  const [errors, setErrors] = useState({
    name: '',
    phoneNumber: '',
    age: '',
    callInDate: '',
  })
  
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
  }
  
  // 입력값 변경 처리
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    // 나이는 숫자로 변환
    if (name === 'age') {
      const numValue = value === '' ? undefined : parseInt(value, 10)
      setFormValues(prev => ({
        ...prev,
        [name]: numValue
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
  
  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 🔥 로그인 사용자 확인
    if (!currentUser) {
      alert('로그인이 필요합니다.');
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
      // 🔥 환자 상태는 '잠재고객'으로 고정, consultationType은 'outbound'로 설정
      // 담당자 정보는 API에서 자동으로 설정됨
      const patientData: CreatePatientData = {
        ...formValues,
        status: '잠재고객' as PatientStatus,
        consultationType: 'outbound' // 신규 환자 등록은 아웃바운드로 설정
      };
      
      console.log('신규 환자 등록 데이터:', patientData); // 디버깅용
      console.log('등록자 정보:', { 
        userId: currentUser.id, 
        userName: currentUser.name 
      }); // 🔥 등록자 정보 로깅
      
      // Redux 액션 디스패치하여 환자 생성
      const result = await dispatch(createPatient(patientData)).unwrap()
      
      // 🔥 환자 등록 성공 시 활동 로그 기록
      try {
        await logPatientAction(
          'patient_create',
          result.id, // 생성된 환자 ID
          result.name, // 생성된 환자 이름
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
        // 로그 실패해도 메인 기능에는 영향 없도록 처리
      }
      
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
          </div>
          <button 
            className="text-text-secondary hover:text-text-primary" 
            onClick={handleClose}
            disabled={isLoading}
          >
            <Icon icon={HiOutlineX} size={20} />
          </button>
        </div>
        
        {/* 모달 바디 */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-5">
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
            
            {/* 연락처 */}
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
                  className={`form-input pl-10 ${errors.phoneNumber ? 'border-error' : ''}`}
                  placeholder="010-1234-5678"
                />
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                  <Icon icon={HiOutlinePhone} size={18} />
                </span>
              </div>
              {errors.phoneNumber && (
                <p className="mt-1 text-sm text-error">{errors.phoneNumber}</p>
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
            
            {/* 환자 상태 필드 제거 - 모든 신규 환자는 '잠재고객'으로 자동 설정 */}
            
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
            
            {/* 메모 */}
            <div>
              <label htmlFor="memo" className="block text-sm font-medium text-text-primary mb-1">
                메모
              </label>
              <div className="relative">
                <textarea
                  id="memo"
                  name="memo"
                  value={formValues.memo}
                  onChange={handleChange}
                  className="form-input pl-10 min-h-[100px]"
                  placeholder="환자 메모를 입력하세요..."
                />
                <span className="absolute left-3 top-6 text-text-muted">
                  <Icon icon={HiOutlineStar} size={18} />
                </span>
              </div>
            </div>
          </div>
          
          {/* 버튼 영역 */}
          <div className="mt-8 flex justify-end gap-3">
            <button 
              type="button" 
              className="btn btn-outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              취소
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isLoading || !currentUser} // 🔥 로그인 안된 경우 비활성화
            >
              {isLoading ? '처리 중...' : '등록하기'}
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