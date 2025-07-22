// src/hooks/usePatientData.ts - React Query 기반 환자 데이터 관리

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const usePatientData = (patientId?: string) => {
  const queryClient = useQueryClient();

  // 환자 목록 조회
  const {
    data: patients,
    isLoading,
    error,
    refetch: refetchPatients
  } = useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      const response = await fetch('/api/patients');
      if (!response.ok) throw new Error('환자 목록 조회 실패');
      const data = await response.json();
      return data.patients || data;
    },
    staleTime: 30000, // 30초간 캐시 유지
    gcTime: 5 * 60 * 1000, // 5분간 메모리 유지
  });

  // 특정 환자 조회
  const {
    data: patient,
    isLoading: isPatientLoading,
    refetch: refetchPatient
  } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const response = await fetch(`/api/patients/${patientId}`);
      if (!response.ok) throw new Error('환자 조회 실패');
      return response.json();
    },
    enabled: !!patientId,
  });

  // 콜백 추가 뮤테이션
  const addCallbackMutation = useMutation({
    mutationFn: async ({ patientId, callbackData }: { 
      patientId: string; 
      callbackData: any; 
    }) => {
      const response = await fetch(`/api/patients/${patientId}/callbacks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(callbackData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '콜백 등록 실패');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      // 즉시 캐시 업데이트
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patient', variables.patientId] });
      
      console.log('✅ 콜백 등록 후 캐시 무효화 완료');
    },
    onError: (error) => {
      console.error('❌ 콜백 등록 실패:', error);
    }
  });

  // 내원 후 상태 업데이트 뮤테이션
  const updatePostVisitMutation = useMutation({
    mutationFn: async ({ patientId, statusData }: {
      patientId: string;
      statusData: any;
    }) => {
      const response = await fetch(`/api/patients/${patientId}/post-visit-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statusData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '상태 업데이트 실패');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      // 즉시 캐시 업데이트
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patient', variables.patientId] });
      
      console.log('✅ 내원 후 상태 업데이트 후 캐시 무효화 완료');
    },
  });

  return {
    patients,
    patient,
    isLoading,
    isPatientLoading,
    error,
    refetchPatients,
    refetchPatient,
    addCallback: addCallbackMutation.mutate,
    updatePostVisit: updatePostVisitMutation.mutate,
    isAddingCallback: addCallbackMutation.isPending,
    isUpdatingPostVisit: updatePostVisitMutation.isPending,
  };
};

// 사용 예시 (VisitManagement.tsx에서)
export default function VisitManagement() {
  const { 
    patients, 
    addCallback, 
    updatePostVisit,
    isAddingCallback,
    refetchPatients 
  } = usePatientData();

  const handleAddVisitCallback = async (patientId: string, callbackData: any) => {
    try {
      await addCallback({ patientId, callbackData });
      // 성공 시 자동으로 캐시가 무효화되어 UI가 업데이트됨
      alert('콜백이 등록되었습니다.');
    } catch (error) {
      alert('콜백 등록에 실패했습니다.');
    }
  };

  // ... 나머지 컴포넌트 로직
}