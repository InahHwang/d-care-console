// src/components/settings/CategorySettings.tsx
'use client'

import { useState, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '@/hooks/reduxHooks'
import { 
  fetchCategories, 
  addCategory, 
  updateCategory, 
  deleteCategory 
} from '@/store/slices/categoriesSlice'
import { MessageCategory } from '@/types/messageLog'
import { 
  HiOutlinePlus, 
  HiOutlinePencil, 
  HiOutlineTrash,
  HiOutlineSave,
  HiOutlineX
} from 'react-icons/hi'
import { Icon } from '../common/Icon'
import DeleteConfirmModal from '../management/DeleteConfirmModal'

export default function CategorySettings() {
  const dispatch = useAppDispatch();
  const categories = useAppSelector(state => state.categories.categories);
  const isLoading = useAppSelector(state => state.categories.isLoading);
  
  const [isAddMode, setIsAddMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MessageCategory | null>(null);
  
  // 폼 상태
  const [formData, setFormData] = useState({
    displayName: '',
    color: 'bg-blue-100 text-blue-800'
  });
  
  const colorOptions = [
    { value: 'bg-blue-100 text-blue-800', label: '파란색', preview: 'bg-blue-100' },
    { value: 'bg-red-100 text-red-800', label: '빨간색', preview: 'bg-red-100' },
    { value: 'bg-green-100 text-green-800', label: '초록색', preview: 'bg-green-100' },
    { value: 'bg-purple-100 text-purple-800', label: '보라색', preview: 'bg-purple-100' },
    { value: 'bg-yellow-100 text-yellow-800', label: '노란색', preview: 'bg-yellow-100' },
    { value: 'bg-pink-100 text-pink-800', label: '분홍색', preview: 'bg-pink-100' },
    { value: 'bg-indigo-100 text-indigo-800', label: '남색', preview: 'bg-indigo-100' },
    { value: 'bg-gray-100 text-gray-800', label: '회색', preview: 'bg-gray-100' },
  ];
  
  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);
  
  const handleAddCategory = () => {
    setIsAddMode(true);
    setEditingId(null);
    setFormData({ displayName: '', color: 'bg-blue-100 text-blue-800' });
  };
  
  const handleEditCategory = (category: MessageCategory) => {
    setIsAddMode(false);
    setEditingId(category.id);
    setFormData({
      displayName: category.displayName,
      color: category.color
    });
  };
  
  const handleSaveCategory = async () => {
    if (!formData.displayName.trim()) {
      alert('카테고리 이름을 입력해주세요.');
      return;
    }
    
    if (isAddMode) {
      await dispatch(addCategory({
        name: formData.displayName.toLowerCase().replace(/\s+/g, '_'),
        displayName: formData.displayName,
        color: formData.color,
        isDefault: false,
        isActive: true
      }));
    } else if (editingId) {
      const categoryToUpdate = categories.find(c => c.id === editingId);
      if (categoryToUpdate) {
        await dispatch(updateCategory({
          ...categoryToUpdate,
          displayName: formData.displayName,
          color: formData.color
        }));
      }
    }
    
    setIsAddMode(false);
    setEditingId(null);
    setFormData({ displayName: '', color: 'bg-blue-100 text-blue-800' });
  };
  
  const handleCancelEdit = () => {
    setIsAddMode(false);
    setEditingId(null);
    setFormData({ displayName: '', color: 'bg-blue-100 text-blue-800' });
  };
  
  const handleDeleteClick = (category: MessageCategory) => {
    if (category.isDefault) {
      alert('기본 카테고리는 삭제할 수 없습니다.');
      return;
    }
    setSelectedCategory(category);
    setIsDeleteModalOpen(true);
  };
  
  const handleDeleteConfirm = async () => {
    if (selectedCategory) {
      await dispatch(deleteCategory(selectedCategory.id));
      setIsDeleteModalOpen(false);
      setSelectedCategory(null);
    }
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-medium text-text-primary">메시지 카테고리 관리</h3>
          <p className="text-sm text-text-secondary mt-1">
            템플릿을 분류할 카테고리를 관리합니다. 기본 카테고리는 수정만 가능합니다.
          </p>
        </div>
        <button
          className="btn btn-primary flex items-center gap-1"
          onClick={handleAddCategory}
          disabled={isAddMode || editingId !== null}
        >
          <Icon icon={HiOutlinePlus} size={16} />
          새 카테고리 추가
        </button>
      </div>
      
      {isLoading ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-t-blue-500 border-blue-200 rounded-full animate-spin mx-auto"></div>
          <p className="mt-2 text-text-secondary">카테고리를 불러오는 중...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 카테고리 추가 폼 */}
          {isAddMode && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <h4 className="font-medium text-blue-800 mb-3">새 카테고리 추가</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    카테고리 이름
                  </label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full p-2 border border-border rounded-md"
                    placeholder="예: VIP 고객, 임플란트 특가 등"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    색상
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color.value}
                        className={`p-2 text-xs rounded-md border-2 flex items-center gap-1 ${
                          formData.color === color.value 
                            ? 'border-blue-500 ' + color.value 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setFormData({ ...formData, color: color.value })}
                      >
                        <div className={`w-3 h-3 rounded-full ${color.preview}`}></div>
                        <span className={formData.color === color.value ? '' : 'text-gray-600'}>
                          {color.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  onClick={handleCancelEdit}
                >
                  취소
                </button>
                <button
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  onClick={handleSaveCategory}
                >
                  저장
                </button>
              </div>
            </div>
          )}
          
          {/* 카테고리 목록 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <div key={category.id} className="border border-border rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
                {editingId === category.id ? (
                  // 편집 모드
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">
                        카테고리 이름
                      </label>
                      <input
                        type="text"
                        value={formData.displayName}
                        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                        className="w-full p-2 text-sm border border-border rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">
                        색상
                      </label>
                      <div className="grid grid-cols-2 gap-1">
                        {colorOptions.slice(0, 4).map((color) => (
                          <button
                            key={color.value}
                            className={`px-2 py-1 text-xs rounded border flex items-center gap-1 ${
                              formData.color === color.value 
                                ? 'border-blue-500 ' + color.value 
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => setFormData({ ...formData, color: color.value })}
                          >
                            <div className={`w-2 h-2 rounded-full ${color.preview}`}></div>
                            {color.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        className="p-1 text-gray-600 hover:text-gray-800"
                        onClick={handleCancelEdit}
                        title="취소"
                      >
                        <Icon icon={HiOutlineX} size={16} />
                      </button>
                      <button
                        className="p-1 text-blue-600 hover:text-blue-800"
                        onClick={handleSaveCategory}
                        title="저장"
                      >
                        <Icon icon={HiOutlineSave} size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  // 보기 모드
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-text-primary mb-2">{category.displayName}</h4>
                        <span className={`inline-block px-2 py-1 text-xs rounded-md ${category.color}`}>
                          {category.displayName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          className="p-1 text-text-secondary hover:text-blue-600"
                          onClick={() => handleEditCategory(category)}
                          title="수정"
                          disabled={isAddMode || editingId !== null}
                        >
                          <Icon icon={HiOutlinePencil} size={16} />
                        </button>
                        {!category.isDefault && (
                          <button
                            className="p-1 text-text-secondary hover:text-red-600"
                            onClick={() => handleDeleteClick(category)}
                            title="삭제"
                            disabled={isAddMode || editingId !== null}
                          >
                            <Icon icon={HiOutlineTrash} size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-text-muted">
                      <span>{category.isDefault ? '기본 카테고리' : '사용자 카테고리'}</span>
                      <span>{new Date(category.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {categories.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-text-secondary mb-4">등록된 카테고리가 없습니다.</p>
              <button
                className="px-4 py-2 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors"
                onClick={handleAddCategory}
              >
                첫 번째 카테고리 추가하기
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* 삭제 확인 모달 */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="카테고리 삭제"
        message={
          selectedCategory 
            ? `정말 '${selectedCategory.displayName}' 카테고리를 삭제하시겠습니까?\n이 카테고리를 사용하는 템플릿들은 기본 카테고리로 변경됩니다.`
            : ''
        }
      />
    </div>
  );
}