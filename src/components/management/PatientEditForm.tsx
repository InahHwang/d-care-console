//src/components/management/PatientEditForm.tsx

'use client'

import { useState, useEffect } from 'react'
import { useAppDispatch } from '@/hooks/reduxHooks'
import { 
  Patient, 
  updatePatient, 
  PatientStatus, 
  UpdatePatientData 
} from '@/store/slices/patientsSlice'
import { 
  HiOutlineX, 
  HiOutlineUser, 
  HiOutlinePhone, 
  HiOutlineCalendar, 
  HiOutlineClipboardList, 
  HiOutlineStar, 
  HiOutlineLocationMarker, 
  HiOutlineCake,
  HiOutlineGlobeAlt 
} from 'react-icons/hi'
import { FiPhone, FiPhoneCall } from 'react-icons/fi'
import { Icon } from '../common/Icon'
import { provinces, getCitiesByProvince } from '@/constants/regionData'

interface PatientEditFormProps {
  patient: Patient;
  onClose: () => void;
  onSuccess?: () => void;
}

// 환자 상태 옵션
const patientStatusOptions = [
  { value: '잠재고객', label: '잠재고객' },
  { value: '콜백필요', label: '콜백필요' },
  { value: '부재중', label: '부재중' },
  { value: '활성고객', label: '활성고객' },
  { value: 'VIP', label: 'VIP' },
  { value: '예약확정', label: '예약 확정' },
  { value: '종결', label: '종결' },
]

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

export default function PatientEditForm({ patient, onClose, onSuccess }: PatientEditFormProps) {
  const dispatch = useAppDispatch()
  
  // 🔥 폼 상태 관리 - consultationType, referralSource 기본값 설정 개선
  const [formValues, setFormValues] = useState<UpdatePatientData>({
    name: patient.name,
    phoneNumber: patient.phoneNumber,
    status: patient.status,
    interestedServices: [...patient.interestedServices],
    notes: patient.notes || '',
    callInDate: patient.callInDate,
    firstConsultDate: patient.firstConsultDate,
    age: patient.age,
    region: patient.region ? { ...patient.region } : undefined,
    consultationType: patient.consultationType || 'outbound', // 🔥 기본값 명시적 설정
    referralSource: patient.referralSource || '', // 🔥 유입경로 기본값 설정
  })
  
  // 지역 선택 상태
  const [selectedProvince, setSelectedProvince] = useState(patient.region?.province || '')
  const [availableCities, setAvailableCities] = useState<string[]>([])
  const [selectedCity, setSelectedCity] = useState(patient.region?.city || '')
  
  // 유효성 검사 상태
  const [errors, setErrors] = useState({
    name: '',
    phoneNumber: '',
    age: '',
    callInDate: '',
  })
  
  // 로딩 상태
  const [isLoading, setIsLoading] = useState(false)
  const [isChanged, setIsChanged] = useState(false)
  
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
  
  // 🔥 폼 변경 감지 개선 - referralSource 포함
  useEffect(() => {
    // 원본 환자 데이터 정규화
    const originalPatient = {
      name: patient.name || '',
      phoneNumber: patient.phoneNumber || '',
      status: patient.status,
      age: patient.age,
      callInDate: patient.callInDate || '',
      notes: patient.notes || '',
      consultationType: patient.consultationType || 'outbound',
      referralSource: patient.referralSource || '', // 🔥 유입경로 포함
      interestedServices: patient.interestedServices || [],
      region: patient.region || undefined
    };

    // 현재 폼 데이터 정규화
    const currentForm = {
      name: formValues.name || '',
      phoneNumber: formValues.phoneNumber || '',
      status: formValues.status,
      age: formValues.age,
      callInDate: formValues.callInDate || '',
      notes: formValues.notes || '',
      consultationType: formValues.consultationType || 'outbound',
      referralSource: formValues.referralSource || '', // 🔥 유입경로 포함
      interestedServices: formValues.interestedServices || [],
      region: formValues.region || undefined
    };

    // 각 필드별 변경 여부 확인
    const isNameChanged = currentForm.name !== originalPatient.name;
    const isPhoneChanged = currentForm.phoneNumber !== originalPatient.phoneNumber;
    const isStatusChanged = currentForm.status !== originalPatient.status;
    const isAgeChanged = currentForm.age !== originalPatient.age;
    const isCallInDateChanged = currentForm.callInDate !== originalPatient.callInDate;
    const isNotesChanged = currentForm.notes !== originalPatient.notes;
    const isConsultationTypeChanged = currentForm.consultationType !== originalPatient.consultationType;
    const isReferralSourceChanged = currentForm.referralSource !== originalPatient.referralSource; // 🔥 유입경로 변경 감지
    
    // 관심 분야 비교 개선
    const isInterestChanged = 
      currentForm.interestedServices.length !== originalPatient.interestedServices.length ||
      !currentForm.interestedServices.every(service => originalPatient.interestedServices.includes(service)) ||
      !originalPatient.interestedServices.every(service => currentForm.interestedServices.includes(service));
    
    // 지역 비교 개선
    let isRegionChanged = false;
    if (currentForm.region && originalPatient.region) {
      isRegionChanged = 
        currentForm.region.province !== originalPatient.region.province ||
        currentForm.region.city !== originalPatient.region.city;
    } else if (currentForm.region !== originalPatient.region) {
      isRegionChanged = true;
    }
    
    const newIsChanged = 
      isNameChanged || 
      isPhoneChanged || 
      isStatusChanged || 
      isAgeChanged || 
      isCallInDateChanged || 
      isNotesChanged || 
      isInterestChanged || 
      isRegionChanged ||
      isConsultationTypeChanged ||
      isReferralSourceChanged; // 🔥 유입경로 변경 포함
    
    console.log('=== 폼 변경 감지 (유입경로 포함) ===');
    console.log('변경 사항:', {
      name: isNameChanged,
      phone: isPhoneChanged,
      status: isStatusChanged,
      age: isAgeChanged,
      callInDate: isCallInDateChanged,
      notes: isNotesChanged,
      consultationType: isConsultationTypeChanged,
      referralSource: isReferralSourceChanged, // 🔥 유입경로 변경 로그
      interest: isInterestChanged,
      region: isRegionChanged
    });
    console.log('최종 isChanged:', newIsChanged);
    
    setIsChanged(newIsChanged);
  }, [formValues, patient]);
  
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
      const updatedServices = prev.interestedServices ? [...prev.interestedServices] : []
      
      if (updatedServices.includes(service)) {
        return {
          ...prev,
          interestedServices: updatedServices.filter(s => s !== service)
        }
      } else {
        return {
          ...prev,
          interestedServices: [...updatedServices, service]
        }
      }
    })
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
  
  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log('=== 폼 제출 시작 ===');
    console.log('isChanged:', isChanged);
    console.log('isLoading:', isLoading);
    console.log('formValues:', formValues);
    
    // 유효성 검사
    let isValid = true
    const newErrors = { 
      name: '', 
      phoneNumber: '', 
      age: '',
      callInDate: '',
    }
    
    if (!formValues.name || !formValues.name.trim()) {
      newErrors.name = '이름을 입력해주세요'
      isValid = false
    }
    
    if (!formValues.phoneNumber || !formValues.phoneNumber.trim()) {
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
      setIsLoading(true)
      
      // 🔥 환자 ID 확인 개선 - _id 우선 사용
      const patientId = patient._id || patient.id;
      if (!patientId) {
        throw new Error('환자 ID를 찾을 수 없습니다.');
      }
      
      console.log('환자 정보 수정 시도:', {
        patientId,
        formValues
      });
      
      // Redux 액션 디스패치
      const result = await dispatch(updatePatient({
        patientId: patientId,
        patientData: formValues
      })).unwrap()
      
      console.log('수정 성공 결과:', result);
      
      // 성공 처리
      alert('환자 정보가 성공적으로 수정되었습니다!')
      if (onSuccess) onSuccess()
      onClose()
    } catch (error) {
      console.error('환자 정보 수정 오류:', error)
      alert(`환자 정보 수정 중 오류가 발생했습니다: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-auto">
        {/* 모달 헤더 */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">환자 정보 수정</h2>
          <button 
            className="text-text-secondary hover:text-text-primary" 
            onClick={onClose}
            disabled={isLoading}
          >
            <Icon icon={HiOutlineX} size={20} />
          </button>
        </div>
        
        {/* 모달 바디 */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-5">
            {/* 환자 ID (수정 불가) */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                환자 ID
              </label>
              <div className="form-input bg-gray-50 text-text-secondary cursor-not-allowed">
                {patient.patientId}
              </div>
            </div>
            
            {/* 🔥 상담 타입 표시 (수정 불가) */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                상담 타입
              </label>
              <div className="flex items-center space-x-2">
                <div className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${
                  (patient.consultationType || 'outbound') === 'inbound' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {(patient.consultationType || 'outbound') === 'inbound' ? (
                    <>
                      <FiPhone className="w-4 h-4 mr-1" />
                      인바운드
                    </>
                  ) : (
                    <>
                      <FiPhoneCall className="w-4 h-4 mr-1" />
                      아웃바운드
                    </>
                  )}
                </div>
                {patient.consultationType === 'inbound' && patient.inboundPhoneNumber && (
                  <span className="text-sm text-gray-500">
                    (입력번호: {patient.inboundPhoneNumber})
                  </span>
                )}
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
                  value={formValues.name || ''}
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
                  value={formValues.phoneNumber || ''}
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
                  value={formValues.referralSource || ''}
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
                  value={formValues.callInDate || ''}
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
                      checked={formValues.interestedServices?.includes(option.value) || false}
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
              <label htmlFor="notes" className="block text-sm font-medium text-text-primary mb-1">
                메모
              </label>
              <div className="relative">
                <textarea
                  id="notes"
                  name="notes"
                  value={formValues.notes || ''}
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
              onClick={onClose}
              disabled={isLoading}
            >
              취소
            </button>
            <button 
              type="submit" 
              className={`btn btn-primary ${(!isChanged || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isLoading || !isChanged}
            >
              {isLoading ? '처리 중...' : '저장하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}