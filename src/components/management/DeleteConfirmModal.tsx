// src/components/management/DeleteConfirmModal.tsx
// 범용 삭제 확인 모달 (V1 Redux 의존성 제거)

'use client'
import { HiOutlineX, HiOutlineExclamationCircle } from 'react-icons/hi'
import { Icon } from '../common/Icon'

interface DeleteConfirmModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onConfirm?: () => void;
  title?: string;
  message?: string;
  icon?: typeof HiOutlineExclamationCircle;
  confirmText?: string;
  cancelText?: string;
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = '삭제 확인',
  message = '정말 삭제하시겠습니까?',
  icon = HiOutlineExclamationCircle,
  confirmText = '삭제',
  cancelText = '취소'
}: DeleteConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[1000] p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-auto relative">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary flex items-center">
            <span className="text-error mr-2">
              <Icon icon={icon} size={20} />
            </span>
            {title}
          </h2>
          <button
            className="text-text-secondary hover:text-text-primary"
            onClick={onClose}
          >
            <Icon icon={HiOutlineX} size={20} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-text-primary whitespace-pre-line">{message}</p>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="btn bg-error text-white hover:bg-error/90"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
