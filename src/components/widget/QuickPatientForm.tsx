// /src/components/widget/QuickPatientForm.tsx

'use client';

import { useState } from 'react';
import { useAppDispatch } from '@/hooks/reduxHooks';
import { createQuickInboundPatient } from '@/store/slices/patientsSlice';
import { FiCheck, FiAlertCircle, FiUser } from 'react-icons/fi';

interface QuickPatientFormProps {
  onSuccess?: () => void;
}

const QuickPatientForm: React.FC<QuickPatientFormProps> = ({ onSuccess }) => {
  const dispatch = useAppDispatch();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber.trim()) {
      setMessage({ type: 'error', text: '전화번호를 입력해주세요.' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const result = await dispatch(createQuickInboundPatient(phoneNumber.trim()));
      
      if (createQuickInboundPatient.fulfilled.match(result)) {
        setMessage({ type: 'success', text: '인바운드 환자가 등록되었습니다!' });
        setPhoneNumber('');
        
        // 성공 후 3초 뒤에 위젯 닫기
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
        <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-2">
          <FiUser className="w-6 h-6 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800">인바운드 상담 등록</h3>
        <p className="text-sm text-gray-600 mt-1">전화번호를 입력하고 엔터를 눌러주세요</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
            전화번호
          </label>
          <input
            type="tel"
            id="phoneNumber"
            value={phoneNumber}
            onChange={handlePhoneNumberChange}
            onKeyPress={handleKeyPress}
            placeholder="010-1234-5678"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            disabled={isLoading}
            autoComplete="tel"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !phoneNumber.trim()}
          className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

      {/* 사용법 안내 */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>💡 <strong>사용법:</strong></p>
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          <li>전화번호 입력 후 엔터 또는 등록 버튼 클릭</li>
          <li>자동으로 인바운드 환자로 분류됩니다</li>
          <li>상세 정보는 환자 관리에서 수정 가능</li>
        </ul>
      </div>
    </div>
  );
};

export default QuickPatientForm;