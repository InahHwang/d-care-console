// src/components/management/DeleteConfirmModal.tsx

'use client'
import { useDispatch, useSelector } from 'react-redux'
import { RootState, AppDispatch } from '@/store'
import { closeDeleteConfirm } from '@/store/slices/uiSlice'
import { deletePatient } from '@/store/slices/patientsSlice'
import { HiOutlineX, HiOutlineExclamation, HiOutlineExclamationCircle } from 'react-icons/hi'
import { Icon } from '../common/Icon'

interface DeleteConfirmModalProps {
  // 외부 props로 제어하는 경우 (템플릿 삭제 등)
  isOpen?: boolean;
  onClose?: () => void;
  onConfirm?: () => void;
  title?: string;
  message?: string;
  // 추가 옵션으로 아이콘 커스터마이징 가능
  icon?: typeof HiOutlineExclamation | typeof HiOutlineExclamationCircle;
  confirmText?: string;
  cancelText?: string;
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  icon = HiOutlineExclamationCircle,
  confirmText = '삭제',
  cancelText = '취소'
}: DeleteConfirmModalProps) {
  const dispatch = useDispatch<AppDispatch>()
  const { isDeleteConfirmOpen, patientToDelete } = useSelector((state: RootState) => state.ui)
  const { patients, isLoading } = useSelector((state: RootState) => state.patients)
  
  // props로 전달된 모드인지 Redux 상태 모드인지 확인
  const isPropMode = isOpen !== undefined && onClose !== undefined && onConfirm !== undefined
  
  // 모달 표시 여부 결정
  const shouldShowModal = isPropMode ? isOpen : (isDeleteConfirmOpen && patientToDelete)
  
  // 삭제할 환자 정보 가져오기 (Redux 모드 전용)
  const patientData = !isPropMode ? patients.find(p => p.id === patientToDelete) : null
  
  // 모달 닫기
  const handleClose = () => {
    if (isPropMode) {
      onClose!()
    } else {
      dispatch(closeDeleteConfirm())
    }
  }
  
  // 삭제 확인
  const handleConfirmDelete = async () => {
  if (isPropMode) {
    onConfirm!()
  } else {
    if (!patientToDelete) return
    
    try {
      // patientToDelete는 이제 MongoDB의 _id 값이거나 기존 id 값 중 하나
      await dispatch(deletePatient(patientToDelete)).unwrap()
      dispatch(closeDeleteConfirm())
    } catch (error) {
      console.error('환자 삭제 오류:', error)
      alert('환자 삭제 중 오류가 발생했습니다.')
    }
  }
}
  
  // 모달이 닫혀 있을 때는 렌더링하지 않음
  if (!shouldShowModal) return null
  
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[1000] p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-auto relative">
        {/* 모달 헤더 */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary flex items-center">
            <span className="text-error mr-2">
              <Icon icon={icon} size={20} />
            </span>
            {isPropMode ? title : '환자 삭제'}
          </h2>
          <button 
            className="text-text-secondary hover:text-text-primary" 
            onClick={handleClose}
            disabled={!isPropMode && isLoading}
          >
            <Icon icon={HiOutlineX} size={20} />
          </button>
        </div>
        
        {/* 모달 바디 */}
        <div className="p-6">
          {isPropMode ? (
            <p className="text-text-primary">{message}</p>
          ) : (
            <>
              <p className="text-text-primary">
                <span className="font-semibold">{patientData?.name}</span> 환자를 삭제하시겠습니까?
              </p>
              <p className="text-text-secondary text-sm mt-2">
                삭제된 환자 정보는 복구할 수 없습니다.
              </p>
            </>
          )}
        </div>
        
        {/* 버튼 영역 */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <button 
            type="button" 
            className="btn btn-outline"
            onClick={handleClose}
            disabled={!isPropMode && isLoading}
          >
            {cancelText}
          </button>
          <button 
            type="button" 
            className="btn bg-error text-white hover:bg-error/90"
            onClick={handleConfirmDelete}
            disabled={!isPropMode && isLoading}
          >
            {!isPropMode && isLoading ? '처리 중...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}