// src/components/admin/AdminLayout.tsx

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/hooks/reduxHooks';
import { HiOutlineArrowLeft, HiOutlineHome } from 'react-icons/hi';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const { user } = useAppSelector(state => state.auth);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 관리자 전용 헤더 */}
      <div className="bg-red-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* 왼쪽: 로고 및 네비게이션 */}
            <div className="flex items-center space-x-4">
              <Link 
                href="/"
                className="flex items-center space-x-2 text-white hover:text-red-200 transition-colors"
              >
                <HiOutlineArrowLeft className="w-5 h-5" />
                <span className="text-sm font-medium">메인으로 돌아가기</span>
              </Link>
              
              <div className="h-6 w-px bg-red-400"></div>
              
              <div className="flex items-center space-x-2">
                <HiOutlineHome className="w-5 h-5" />
                <span className="font-semibold">관리자 콘솔</span>
              </div>
            </div>

            {/* 오른쪽: 사용자 정보 */}
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <div className="text-sm font-medium">
                  {user?.name || 'Master Admin'}
                </div>
                <div className="text-xs text-red-200">
                  마스터 관리자
                </div>
              </div>
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold">
                  {user?.name?.charAt(0).toUpperCase() || 'M'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* 관리자 전용 푸터 */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              D-Care Console Admin Panel v1.0
            </div>
            <div className="text-sm text-gray-500">
              마스터 관리자 전용 시스템
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}