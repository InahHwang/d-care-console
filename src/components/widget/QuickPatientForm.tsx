// /src/components/widget/QuickPatientForm.tsx

'use client';

import { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks';
import { createQuickInboundPatient } from '@/store/slices/patientsSlice';
import { FiCheck, FiAlertCircle, FiPhoneCall, FiX } from 'react-icons/fi';

interface QuickPatientFormProps {
  onSuccess?: () => void;
}

const QuickPatientForm: React.FC<QuickPatientFormProps> = ({ onSuccess }) => {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector(state => state.auth.user);
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
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

  // 🔥 전화번호 중복 체크 함수
  const checkPhoneNumber = async (phone: string) => {
    if (!phone || phone.length < 13) { // 010-1234-5678 최소 길이
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
        body: JSON.stringify({ phoneNumber: phone }),
      })

      const data = await response.json()

      if (data.exists) {
        setPhoneCheckStatus({
          isChecking: false,
          isDuplicate: true,
          existingPatient: data.patient,
          message: `이미 등록된 전화번호입니다. (${data.patient.name}님)`
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
      if (phoneNumber) {
        checkPhoneNumber(phoneNumber)
      }
    }, 500) // 0.5초 지연

    return () => clearTimeout(timeoutId)
  }, [phoneNumber])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber.trim()) {
      setMessage({ type: 'error', text: '전화번호를 입력해주세요.' });
      return;
    }

    if (!currentUser) {
      setMessage({ type: 'error', text: '로그인이 필요합니다.' });
      return;
    }

    // 🔥 전화번호 중복 체크
    if (phoneCheckStatus.isDuplicate) {
      setMessage({ type: 'error', text: '이미 등록된 전화번호입니다.' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const result = await dispatch(createQuickInboundPatient({
        phoneNumber: phoneNumber.trim(),
        userInfo: currentUser
      }));
      
      if (createQuickInboundPatient.fulfilled.match(result)) {
        setMessage({ type: 'success', text: '인바운드 환자가 등록되었습니다!' });
        setPhoneNumber('');
        
        // 🔥 전화번호 체크 상태 초기화
        setPhoneCheckStatus({
          isChecking: false,
          isDuplicate: false,
          existingPatient: null,
          message: ''
        })
        
        // 성공 후 2초 뒤에 위젯 닫기
        setTimeout(() => {
          onSuccess?.();
        }, 2000);
      } else {
        const errorMessage = result.payload as string;
        setMessage({ type: 'error', text: errorMessage });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '등록 중 오류가 발생했습니다.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  const formatPhoneNumber = (value: string) => {
    // 숫자만 추출
    const numbers = value.replace(/[^\d]/g, '');
    
    // 한국 전화번호 형식으로 포맷팅
    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    } else if (numbers.length <= 11) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
    }
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-100 rounded-full mb-2">
          <FiPhoneCall className="w-6 h-6 text-orange-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800">인바운드 상담 등록</h3>
        <p className="text-sm text-gray-600 mt-1">전화번호를 입력하고 엔터를 눌러주세요</p>
        <p className="text-xs text-orange-600 mt-1 font-medium">📞 자동으로 인바운드 상담으로 등록됩니다</p>
        {currentUser && (
          <p className="text-xs text-orange-600 mt-1">
            담당자: {currentUser.name || currentUser.id}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
            전화번호
          </label>
          <div className="relative">
            <input
              type="tel"
              id="phoneNumber"
              value={phoneNumber}
              onChange={handlePhoneNumberChange}
              onKeyPress={handleKeyPress}
              placeholder="010-1234-5678"
              className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm ${
                phoneCheckStatus.isDuplicate ? 'border-red-500' :
                phoneCheckStatus.message && !phoneCheckStatus.isDuplicate ? 'border-green-500' : 
                'border-gray-300'
              }`}
              disabled={isLoading || !currentUser}
              autoComplete="tel"
            />
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
                {phoneCheckStatus.isDuplicate ? <FiX size={16} /> : <FiCheck size={16} />}
              </span>
            )}
          </div>
          
          {/* 🔥 전화번호 중복 체크 메시지 */}
          {phoneCheckStatus.message && (
            <div className={`mt-2 p-2 rounded-md flex items-center gap-2 text-xs ${
              phoneCheckStatus.isDuplicate 
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {phoneCheckStatus.isDuplicate ? <FiAlertCircle size={14} /> : <FiCheck size={14} />}
              <span>{phoneCheckStatus.message}</span>
            </div>
          )}
          
          {/* 🔥 중복 환자 정보 간단 표시 */}
          {phoneCheckStatus.isDuplicate && phoneCheckStatus.existingPatient && (
            <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded-md">
              <p className="text-xs font-medium text-gray-800">기존 환자:</p>
              <div className="text-xs text-gray-600">
                {phoneCheckStatus.existingPatient.name} ({phoneCheckStatus.existingPatient.patientId})
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={
            isLoading || 
            !phoneNumber.trim() || 
            !currentUser || 
            phoneCheckStatus.isDuplicate ||
            phoneCheckStatus.isChecking
          }
          className={`w-full flex items-center justify-center px-4 py-2 text-white text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors ${
            phoneCheckStatus.isDuplicate || phoneCheckStatus.isChecking
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-orange-600 hover:bg-orange-700'
          }`}
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              등록 중...
            </>
          ) : (
            <>
              <FiCheck className="w-4 h-4 mr-2" />
              빠른 등록
            </>
          )}
        </button>
      </form>

      {/* 상태 메시지 */}
      {message && (
        <div className={`flex items-center space-x-2 p-3 rounded-md text-sm ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <FiCheck className="w-4 h-4 flex-shrink-0" />
          ) : (
            <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* 로그인 상태 확인 메시지 */}
      {!currentUser && (
        <div className="bg-yellow-50 text-yellow-800 border border-yellow-200 p-3 rounded-md text-sm">
          <div className="flex items-center space-x-2">
            <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>로그인이 필요합니다.</span>
          </div>
        </div>
      )}

      {/* 사용법 안내 */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>💡 <strong>사용법:</strong></p>
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          <li>전화번호 입력 후 엔터 또는 등록 버튼 클릭</li>
          <li><span className="text-orange-600 font-medium">자동으로 인바운드 상담으로 분류됩니다</span></li>
          <li><span className="text-orange-600 font-medium">중복 전화번호는 자동으로 체크됩니다</span></li>
          <li>상세 정보는 환자 관리에서 수정 가능</li>
          <li>담당자는 현재 로그인한 사용자로 자동 설정</li>
        </ul>
      </div>
    </div>
  );
};

export default QuickPatientForm;