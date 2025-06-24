// src/components/debug/TempLogin.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TempLogin() {
  const [tempPassword, setTempPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleTempLogin = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/debug/temp-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tempPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('임시 로그인 성공! 메인 페이지로 이동합니다.');
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 1000);
      } else {
        setMessage(`로그인 실패: ${data.error}`);
      }
    } catch (error: any) {
      setMessage(`오류: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            임시 관리자 로그인
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            데이터베이스 복구를 위한 임시 로그인입니다.
          </p>
        </div>
        <div className="mt-8 space-y-6">
          <div>
            <label htmlFor="temp-password" className="sr-only">
              임시 비밀번호
            </label>
            <input
              id="temp-password"
              name="temp-password"
              type="password"
              required
              className="relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="임시 비밀번호 입력"
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
            />
          </div>

          <div>
            <button
              onClick={handleTempLogin}
              disabled={loading || !tempPassword}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? '로그인 중...' : '임시 로그인'}
            </button>
          </div>

          {message && (
            <div className={`text-center text-sm ${
              message.includes('성공') ? 'text-green-600' : 'text-red-600'
            }`}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}