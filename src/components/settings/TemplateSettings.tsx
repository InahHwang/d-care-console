// src/components/settings/TemplateSettings.tsx

'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAppSelector, useAppDispatch } from '@/hooks/reduxHooks'
import { 
  fetchTemplates, 
  addTemplate, 
  updateTemplate, 
  deleteTemplate 
} from '@/store/slices/templatesSlice'
import { 
  fetchCategories, 
  addCategory, 
  updateCategory, 
  deleteCategory 
} from '@/store/slices/categoriesSlice'
import { MessageTemplate, MessageType, RcsButton, MessageCategory, EventCategory } from '@/types/messageLog'
import { 
  HiOutlineTemplate, 
  HiOutlinePencil, 
  HiOutlineTrash,
  HiOutlinePlus,
  HiOutlineDocumentText,
  HiOutlineCollection,
  HiOutlineSave,
  HiOutlineX
} from 'react-icons/hi'
import { Icon } from '../common/Icon'
import TemplateFormModal from '../management/TemplateFormModal'
import DeleteConfirmModal from '../management/DeleteConfirmModal'

export default function TemplateSettings() {
  const dispatch = useAppDispatch();
  const templates = useAppSelector(state => state.templates.templates);
  const categories = useAppSelector(state => state.categories.categories);
  const isLoading = useAppSelector(state => state.templates.isLoading);
  
  // 템플릿 관련 상태
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [activeCategory, setActiveCategory] = useState<EventCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // 상위 탭 상태 (템플릿 관리 vs 카테고리 관리)
  const [activeSubTab, setActiveSubTab] = useState<'templates' | 'categories'>('templates');
  
  // 카테고리 관리 상태
  const [isAddCategoryMode, setIsAddCategoryMode] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [isCategoryDeleteModalOpen, setIsCategoryDeleteModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MessageCategory | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({
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
  
  // 데이터 불러오기
  useEffect(() => {
    dispatch(fetchTemplates());
    dispatch(fetchCategories());
  }, [dispatch]);
  
  // 카테고리 관련 헬퍼 함수들
  const getCategoryDisplayName = (categoryId: string) => {
    const categoryObj = categories.find(c => c.id === categoryId);
    return categoryObj?.displayName || categoryId;
  };
  
  const getCategoryColor = (categoryId: string) => {
    const categoryObj = categories.find(c => c.id === categoryId);
    return categoryObj?.color || 'bg-gray-100 text-gray-800';
  };
  
  // 카테고리 옵션 생성
  const eventCategoryOptions = useMemo(() => {
    return categories.filter(c => c.isActive).map(cat => ({
      value: cat.id,
      label: cat.displayName
    }));
  }, [categories]);
  
  // 템플릿 필터링
  const filteredTemplates = templates.filter((template: MessageTemplate) => {
    if (activeCategory !== 'all' && template.category !== activeCategory) {
      return false;
    }
    
    if (searchTerm && !template.title.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    return true;
  });
  
  // 템플릿 관련 핸들러들
  const handleAddTemplate = () => {
    setSelectedTemplate(null);
    setIsFormModalOpen(true);
  };
  
  const handleEditTemplate = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setIsFormModalOpen(true);
  };
  
  const handleDeleteClick = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setIsDeleteModalOpen(true);
  };
  
  const handleDeleteConfirm = async () => {
    if (selectedTemplate) {
      await dispatch(deleteTemplate(selectedTemplate.id));
      setIsDeleteModalOpen(false);
      setSelectedTemplate(null);
    }
  };
  
  // 🔥 수정된 템플릿 저장 핸들러 - Promise<void> 반환하도록 변경
  const handleSaveTemplate = async (template: MessageTemplate): Promise<void> => {
    console.log('💾 TemplateSettings - handleSaveTemplate 호출됨');
    console.log('💾 받은 template:', template);
    
    try {
      // 기존 템플릿 찾기
      const existingTemplate = templates.find(t => t.id === template.id);
      console.log('💾 기존 템플릿 찾기 결과:', existingTemplate);
      
      if (existingTemplate) {
        console.log('✏️ 수정 모드 - updateTemplate 호출');
        await dispatch(updateTemplate(template)).unwrap();
      } else {
        console.log('➕ 추가 모드 - addTemplate 호출');
        await dispatch(addTemplate(template)).unwrap();
      }
      
      console.log('🔄 저장 완료 후 fetchTemplates 호출');
      await dispatch(fetchTemplates()).unwrap();
      
      console.log('✅ TemplateSettings - 템플릿 저장 완료');
    } catch (error) {
      console.error('❌ TemplateSettings - 템플릿 저장 실패:', error);
      throw error; // 에러를 다시 throw하여 모달에서 처리할 수 있도록 함
    }
  };
  
  // 카테고리 관련 핸들러들
  const handleAddCategory = () => {
    setIsAddCategoryMode(true);
    setEditingCategoryId(null);
    setCategoryFormData({ displayName: '', color: 'bg-blue-100 text-blue-800' });
  };
  
  const handleEditCategory = (category: MessageCategory) => {
    setIsAddCategoryMode(false);
    setEditingCategoryId(category.id);
    setCategoryFormData({
      displayName: category.displayName,
      color: category.color
    });
  };
  
  const handleSaveCategory = async () => {
    if (!categoryFormData.displayName.trim()) {
      alert('카테고리 이름을 입력해주세요.');
      return;
    }
    
    if (isAddCategoryMode) {
      await dispatch(addCategory({
        name: categoryFormData.displayName.toLowerCase().replace(/\s+/g, '_'),
        displayName: categoryFormData.displayName,
        color: categoryFormData.color,
        isDefault: false,
        isActive: true
      }));
    } else if (editingCategoryId) {
      const categoryToUpdate = categories.find(c => c.id === editingCategoryId);
      if (categoryToUpdate) {
        await dispatch(updateCategory({
          ...categoryToUpdate,
          displayName: categoryFormData.displayName,
          color: categoryFormData.color
        }));
      }
    }
    
    setIsAddCategoryMode(false);
    setEditingCategoryId(null);
    setCategoryFormData({ displayName: '', color: 'bg-blue-100 text-blue-800' });
  };
  
  const handleCancelCategoryEdit = () => {
    setIsAddCategoryMode(false);
    setEditingCategoryId(null);
    setCategoryFormData({ displayName: '', color: 'bg-blue-100 text-blue-800' });
  };
  
  const handleCategoryDeleteClick = (category: MessageCategory) => {
    if (category.isDefault) {
      alert('기본 카테고리는 삭제할 수 없습니다.');
      return;
    }
    setSelectedCategory(category);
    setIsCategoryDeleteModalOpen(true);
  };
  
  const handleCategoryDeleteConfirm = async () => {
    if (selectedCategory) {
      await dispatch(deleteCategory(selectedCategory.id));
      setIsCategoryDeleteModalOpen(false);
      setSelectedCategory(null);
    }
  };
  
  return (
    <div>
      {/* 상위 탭 (템플릿 관리 vs 카테고리 관리) */}
      <div className="flex gap-1 mb-6 border-b border-border">
        <button
          className={`px-4 py-2 font-medium rounded-t-md flex items-center gap-2 ${
            activeSubTab === 'templates'
              ? 'bg-white text-blue-600 border-b-2 border-blue-600'
              : 'text-text-secondary hover:text-text-primary'
          }`}
          onClick={() => setActiveSubTab('templates')}
        >
          <Icon icon={HiOutlineTemplate} size={16} />
          템플릿 관리
        </button>
        <button
          className={`px-4 py-2 font-medium rounded-t-md flex items-center gap-2 ${
            activeSubTab === 'categories'
              ? 'bg-white text-blue-600 border-b-2 border-blue-600'
              : 'text-text-secondary hover:text-text-primary'
          }`}
          onClick={() => setActiveSubTab('categories')}
        >
          <Icon icon={HiOutlineCollection} size={16} />
          카테고리 관리
        </button>
      </div>
      
      {/* 템플릿 관리 탭 */}
      {activeSubTab === 'templates' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-text-primary">메시지 템플릿 관리</h3>
            <button
              className="btn btn-primary flex items-center gap-1"
              onClick={handleAddTemplate}
            >
              <Icon icon={HiOutlinePlus} size={16} />
              새 템플릿 추가
            </button>
          </div>
          
          {/* 검색 및 필터 */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
            <div className="w-full md:w-64">
              <div className="relative">
                <input
                  type="text"
                  placeholder="템플릿 검색..."
                  className="w-full pl-9 pr-4 py-2 border border-border rounded-md"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Icon 
                  icon={HiOutlineDocumentText} 
                  size={16} 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" 
                />
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                  activeCategory === 'all'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                }`}
                onClick={() => setActiveCategory('all')}
              >
                전체
              </button>
              {eventCategoryOptions.map((cat) => (
                <button
                  key={cat.value}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                    activeCategory === cat.value
                      ? getCategoryColor(cat.value)
                      : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                  }`}
                  onClick={() => setActiveCategory(cat.value)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* 템플릿 목록 */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-t-blue-500 border-blue-200 rounded-full animate-spin mx-auto"></div>
              <p className="mt-4 text-text-secondary">템플릿을 불러오는 중...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.length === 0 ? (
                <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg">
                  <p className="text-text-secondary">
                    {searchTerm ? '검색 결과가 없습니다.' : '등록된 템플릿이 없습니다.'}
                  </p>
                  <button
                    className="mt-4 px-4 py-2 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors"
                    onClick={handleAddTemplate}
                  >
                    새 템플릿 추가하기
                  </button>
                </div>
              ) : (
                filteredTemplates.map((template: MessageTemplate) => (
                  <div 
                    key={template.id}
                    className="border border-border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
                  >
                    {/* 템플릿 헤더 */}
                    <div className="px-4 py-3 bg-gray-50 border-b border-border flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${
                          template.type === 'SMS' ? 'bg-blue-500' : 
                          template.type === 'LMS' ? 'bg-purple-500' :
                          template.type === 'MMS' ? 'bg-green-500' : 'bg-orange-500'
                        }`}></span>
                        <h3 className="font-medium text-text-primary truncate max-w-[180px]" title={template.title}>
                          {template.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          className="p-1.5 text-text-secondary hover:text-blue-600 hover:bg-blue-50 rounded-md"
                          onClick={() => handleEditTemplate(template)}
                          title="템플릿 수정"
                        >
                          <Icon icon={HiOutlinePencil} size={16} />
                        </button>
                        <button
                          className="p-1.5 text-text-secondary hover:text-red-600 hover:bg-red-50 rounded-md"
                          onClick={() => handleDeleteClick(template)}
                          title="템플릿 삭제"
                        >
                          <Icon icon={HiOutlineTrash} size={16} />
                        </button>
                      </div>
                    </div>
                    
                    {/* 템플릿 내용 */}
                    <div className="p-4">
                      <div className="flex gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-gray-100 text-text-secondary text-xs rounded">
                          {template.type}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded ${getCategoryColor(template.category)}`}>
                          {getCategoryDisplayName(template.category)}
                        </span>
                      </div>
                      
                      {/* 이미지 표시 (MMS 또는 RCS인 경우) */}
                      {(template.imageUrl || (template.rcsOptions?.thumbnails && template.rcsOptions.thumbnails.length > 0)) && (
                        <div className="mb-3">
                          {template.imageUrl && (
                            <img 
                              src={template.imageUrl} 
                              alt="템플릿 이미지" 
                              className="w-full h-32 object-cover rounded-md"
                            />
                          )}
                          {template.rcsOptions?.thumbnails && template.rcsOptions.thumbnails.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto py-2">
                              {template.rcsOptions.thumbnails.map((thumb: string, idx: number) => (
                                <img 
                                  key={idx} 
                                  src={thumb} 
                                  alt={`미리보기 ${idx+1}`} 
                                  className="w-20 h-20 object-cover rounded-md flex-shrink-0"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* 텍스트 내용 */}
                      <p className="text-sm text-text-secondary line-clamp-3 whitespace-pre-line">
                        {template.content}
                      </p>
                      
                      {/* RCS 버튼 (있는 경우) */}
                      {template.type === 'RCS' && template.rcsOptions?.buttons && template.rcsOptions.buttons.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs text-text-muted mb-2">버튼</p>
                          <div className="flex flex-wrap gap-2">
                            {template.rcsOptions.buttons.map((btn: RcsButton, idx: number) => (
                              <span key={idx} className="px-2 py-1 bg-gray-100 text-text-primary text-sm rounded-md">
                                {btn.buttonName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* 템플릿 푸터 */}
                    <div className="px-4 py-2 border-t border-border bg-gray-50 text-xs text-text-muted">
                      마지막 수정: {new Date(template.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
      
      {/* 카테고리 관리 탭 */}
      {activeSubTab === 'categories' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-medium text-text-primary">카테고리 관리</h3>
              <p className="text-sm text-text-secondary mt-1">
                템플릿을 분류할 카테고리를 관리합니다. 기본 카테고리는 수정만 가능합니다.
              </p>
            </div>
            <button
              className="btn btn-primary flex items-center gap-1"
              onClick={handleAddCategory}
              disabled={isAddCategoryMode || editingCategoryId !== null}
            >
              <Icon icon={HiOutlinePlus} size={16} />
              새 카테고리 추가
            </button>
          </div>
          
          <div className="space-y-4">
            {/* 카테고리 추가 폼 */}
            {isAddCategoryMode && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                <h4 className="font-medium text-blue-800 mb-3">새 카테고리 추가</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      카테고리 이름
                    </label>
                    <input
                      type="text"
                      value={categoryFormData.displayName}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, displayName: e.target.value })}
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
                            categoryFormData.color === color.value 
                              ? 'border-blue-500 ' + color.value 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setCategoryFormData({ ...categoryFormData, color: color.value })}
                        >
                          <div className={`w-3 h-3 rounded-full ${color.preview}`}></div>
                          <span className={categoryFormData.color === color.value ? '' : 'text-gray-600'}>
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
                    onClick={handleCancelCategoryEdit}
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
                  {editingCategoryId === category.id ? (
                    // 편집 모드
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                          카테고리 이름
                        </label>
                        <input
                          type="text"
                          value={categoryFormData.displayName}
                          onChange={(e) => setCategoryFormData({ ...categoryFormData, displayName: e.target.value })}
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
                                categoryFormData.color === color.value 
                                  ? 'border-blue-500 ' + color.value 
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                              onClick={() => setCategoryFormData({ ...categoryFormData, color: color.value })}
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
                          onClick={handleCancelCategoryEdit}
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
                            disabled={isAddCategoryMode || editingCategoryId !== null}
                          >
                            <Icon icon={HiOutlinePencil} size={16} />
                          </button>
                          {!category.isDefault && (
                            <button
                              className="p-1 text-text-secondary hover:text-red-600"
                              onClick={() => handleCategoryDeleteClick(category)}
                              title="삭제"
                              disabled={isAddCategoryMode || editingCategoryId !== null}
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
        </div>
      )}
      
      {/* 템플릿 폼 모달 */}
      <TemplateFormModal 
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSaveTemplate}
        template={selectedTemplate}
      />
      
      {/* 템플릿 삭제 확인 모달 */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="템플릿 삭제"
        message={`정말 '${selectedTemplate?.title}' 템플릿을 삭제하시겠습니까?`}
      />
      
      {/* 카테고리 삭제 확인 모달 */}
      <DeleteConfirmModal
        isOpen={isCategoryDeleteModalOpen}
        onClose={() => setIsCategoryDeleteModalOpen(false)}
        onConfirm={handleCategoryDeleteConfirm}
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