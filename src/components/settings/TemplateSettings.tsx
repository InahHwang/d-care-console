'use client'

import { useState, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '@/hooks/reduxHooks'
import { 
  fetchTemplates, 
  addTemplate, 
  updateTemplate, 
  deleteTemplate 
} from '@/store/slices/templatesSlice'
import { MessageTemplate, MessageType, RcsButton } from '@/types/messageLog'
import { EventCategory } from '@/store/slices/patientsSlice'
import { 
  HiOutlineTemplate, 
  HiOutlinePencil, 
  HiOutlineTrash,
  HiOutlinePlus,
  HiOutlineDocumentText
} from 'react-icons/hi'
import { Icon } from '../common/Icon'
import TemplateFormModal from '../management/TemplateFormModal'
import DeleteConfirmModal from '../management/DeleteConfirmModal'


export default function TemplateSettings() {
  const dispatch = useAppDispatch();
  const templates = useAppSelector(state => state.templates.templates);
  const isLoading = useAppSelector(state => state.templates.isLoading);
  
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [activeCategory, setActiveCategory] = useState<EventCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // 템플릿 불러오기
  useEffect(() => {
    console.log('컴포넌트 마운트: fetchTemplates 호출');
    
    // localStorage 직접 확인
    const storedTemplates = localStorage.getItem('messageTemplates');
    console.log('localStorage에 저장된 템플릿 (직접확인):', 
      storedTemplates ? JSON.parse(storedTemplates) : '없음');
    
    dispatch(fetchTemplates());
    
    // 컴포넌트 언마운트 시에도 마지막으로 한번 더 확인
    return () => {
      console.log('컴포넌트 언마운트: 마지막 localStorage 확인');
      const finalTemplates = localStorage.getItem('messageTemplates');
      console.log('최종 localStorage 템플릿:', 
        finalTemplates ? JSON.parse(finalTemplates) : '없음');
    };
  }, [dispatch]);
  
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
  
  // 템플릿 폼 모달 열기 (추가)
  const handleAddTemplate = () => {
    setSelectedTemplate(null);
    setIsFormModalOpen(true);
  };
  
  // 템플릿 폼 모달 열기 (수정)
  const handleEditTemplate = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setIsFormModalOpen(true);
  };
  
  // 템플릿 삭제 모달 열기
  const handleDeleteClick = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setIsDeleteModalOpen(true);
  };
  
  // 템플릿 삭제 확인
  const handleDeleteConfirm = () => {
    if (selectedTemplate) {
      dispatch(deleteTemplate(selectedTemplate.id));
      setIsDeleteModalOpen(false);
    }
  };
  
  // 템플릿 저장 (추가 또는 수정)
  const handleSaveTemplate = (template: MessageTemplate) => {
    console.log('저장할 템플릿 데이터:', template);
    
    if (template.id) {
      console.log('템플릿 업데이트 시도...');
      dispatch(updateTemplate(template))
        .unwrap()
        .then(updatedTemplate => {
          console.log('템플릿 업데이트 성공:', updatedTemplate);
          
          // localStorage에 직접 저장 (임시 해결책)
          const storedTemplates = localStorage.getItem('messageTemplates');
          const templates = storedTemplates ? JSON.parse(storedTemplates) : [];
          const index = templates.findIndex((t: any) => t.id === template.id);
          
          if (index !== -1) {
            templates[index] = template;
          } else {
            templates.push(template);
          }
          
          localStorage.setItem('messageTemplates', JSON.stringify(templates));
          console.log('localStorage에 직접 저장됨:', templates);
          
          // 여기에 추가: 템플릿 목록 다시 불러오기
          dispatch(fetchTemplates());
          
          setIsFormModalOpen(false);
        })
        .catch(error => {
          console.error('템플릿 업데이트 실패:', error);
          alert('템플릿 업데이트에 실패했습니다.');
        });
    } else {
      console.log('새 템플릿 추가 시도...');
      dispatch(addTemplate(template))
        .unwrap()
        .then(newTemplate => {
          console.log('템플릿 추가 성공:', newTemplate);
          
          // localStorage에 직접 저장 (임시 해결책)
          const storedTemplates = localStorage.getItem('messageTemplates');
          const templates = storedTemplates ? JSON.parse(storedTemplates) : [];
          templates.unshift(newTemplate);
          localStorage.setItem('messageTemplates', JSON.stringify(templates));
          console.log('localStorage에 직접 저장됨:', templates);
          
          setIsFormModalOpen(false);
        })
        .catch(error => {
          console.error('템플릿 추가 실패:', error);
          alert('템플릿 추가에 실패했습니다.');
        });
    }
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium text-text-primary">메시지 템플릿 관리</h3>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-secondary text-sm"
            onClick={() => {
              // 수동으로 템플릿 목록 다시 불러오기
              dispatch(fetchTemplates());
              console.log('템플릿 목록 새로고침 요청됨');
            }}
          >
            목록 새로고침
          </button>
          <button
            className="btn btn-primary flex items-center gap-1"
            onClick={handleAddTemplate}
          >
            <Icon icon={HiOutlinePlus} size={16} />
            새 템플릿 추가
          </button>
        </div>
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
          <button
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
              activeCategory === 'discount'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
            }`}
            onClick={() => setActiveCategory('discount')}
          >
            할인/프로모션
          </button>
          <button
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
              activeCategory === 'new_treatment'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
            }`}
            onClick={() => setActiveCategory('new_treatment')}
          >
            신규 치료
          </button>
          <button
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
              activeCategory === 'checkup'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
            }`}
            onClick={() => setActiveCategory('checkup')}
          >
            정기 검진
          </button>
          <button
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
              activeCategory === 'seasonal'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
            }`}
            onClick={() => setActiveCategory('seasonal')}
          >
            계절 이벤트
          </button>
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
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                      {template.category === 'discount' && '할인/프로모션'}
                      {template.category === 'new_treatment' && '신규 치료'}
                      {template.category === 'checkup' && '정기 검진'}
                      {template.category === 'seasonal' && '계절 이벤트'}
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
      
      {/* 템플릿 폼 모달 */}
      <TemplateFormModal 
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSaveTemplate}
        template={selectedTemplate}
      />
      
      {/* 삭제 확인 모달 */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="템플릿 삭제"
        message={`정말 '${selectedTemplate?.title}' 템플릿을 삭제하시겠습니까?`}
      />
    </div>
  );
}