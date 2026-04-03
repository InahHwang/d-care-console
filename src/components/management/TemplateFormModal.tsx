// src/components/management/TemplateFormModal.tsx

'use client'

import { authFetch } from '@/utils/authFetch';
import { useState, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '@/hooks/reduxHooks'
import { fetchCategories } from '@/store/slices/categoriesSlice'
import { 
  HiOutlineX, 
  HiOutlineSave,
  HiOutlineUpload,
  HiOutlineTrash,
  HiOutlinePlus
} from 'react-icons/hi'
import { Icon } from '../common/Icon'
import { MessageTemplate, MessageType, EventCategory } from '@/types/messageLog'
import { v4 as uuidv4 } from 'uuid'

interface TemplateFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: MessageTemplate) => Promise<void>; // Promise 반환으로 변경
  template: MessageTemplate | null;
}

export default function TemplateFormModal({
  isOpen,
  onClose,
  onSave,
  template
}: TemplateFormModalProps) {
  const dispatch = useAppDispatch();
  const categories = useAppSelector(state => state.categories.categories);
  
  // 폼 상태
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<EventCategory>('discount');
  const [messageType, setMessageType] = useState<MessageType>('SMS');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // 저장 상태 추가
  const [isSaving, setIsSaving] = useState(false);
  
  // 이미지 업로드 상태
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageInfo, setImageInfo] = useState<{
    originalSize?: string;
    optimizedSize?: string;
    dimensions?: string;
    format?: string;
  } | null>(null);
  
  // RCS 옵션
  const [rcsCardType, setRcsCardType] = useState<'basic' | 'carousel' | 'commerce'>('basic');
  const [rcsButtons, setRcsButtons] = useState<Array<{
    buttonType: 'url' | 'phone' | 'map';
    buttonName: string;
    buttonUrl?: string;
    phoneNumber?: string;
    address?: string;
  }>>([]);
  const [rcsThumbnails, setRcsThumbnails] = useState<string[]>([]);
  const [rcsProductInfo, setRcsProductInfo] = useState({
    productName: '',
    price: '',
    currencyUnit: '원'
  });
  
  // 카테고리 불러오기
  useEffect(() => {
    if (isOpen) {
      dispatch(fetchCategories());
    }
  }, [isOpen, dispatch]);
  
  // 카테고리 관련 헬퍼 함수들
  const getCategoryDisplayName = (categoryId: string) => {
    const categoryObj = categories.find(c => c.id === categoryId);
    return categoryObj?.displayName || categoryId;
  };
  
  const getCategoryColor = (categoryId: string) => {
    const categoryObj = categories.find(c => c.id === categoryId);
    return categoryObj?.color || 'bg-gray-100 text-gray-800';
  };
  
  // 이미지 업로드 처리
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    console.log('📄 이미지 파일 선택:', file.name, `${(file.size / 1024).toFixed(1)}KB`);
    
    // 파일 크기 사전 검증 (1MB)
    if (file.size > 1024 * 1024) {
      setUploadError('파일 크기는 1MB를 초과할 수 없습니다.');
      return;
    }
    
    // 파일 형식 사전 검증
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('지원하지 않는 파일 형식입니다. (JPG, PNG, GIF, WebP 가능)');
      return;
    }
    
    setImageFile(file);
    setUploadError(null);
    setImageInfo(null);
    
    // 로컬 미리보기 생성
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    
    // 즉시 업로드 처리
    await handleImageUpload(file);
  };
  
  // 실제 이미지 업로드 함수
  const handleImageUpload = async (file: File) => {
    setIsImageUploading(true);
    setUploadError(null);
    
    try {
      console.log('🚀 이미지 업로드 시작:', file.name);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await authFetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '이미지 업로드에 실패했습니다.');
      }
      
      const data = await response.json();
      console.log('✅ 이미지 업로드 성공:', data);
      
      // 업로드된 이미지 URL 설정
      setImageUrl(data.imageUrl);
      
      // 미리보기 업데이트
      if (data.imageUrl.startsWith('data:')) {
        setPreviewImage(data.imageUrl);
      } else {
        setPreviewImage(data.imageUrl);
      }
      
      // 이미지 정보 설정
      setImageInfo({
        originalSize: data.originalSize,
        optimizedSize: data.optimizedSize,
        dimensions: data.dimensions,
        format: data.format
      });
      
      if (data.message) {
        console.log('📋 업로드 메시지:', data.message);
      }
      
    } catch (error: any) {
      console.error('💥 이미지 업로드 실패:', error);
      setUploadError(error.message || '이미지 업로드 중 오류가 발생했습니다.');
      
      // 실패 시 상태 리셋
      setImageFile(null);
      setImageUrl('');
      setImageInfo(null);
      
    } finally {
      setIsImageUploading(false);
    }
  };
  
  // 이미지 삭제
  const handleRemoveImage = () => {
    setImageFile(null);
    setPreviewImage(null);
    setImageUrl('');
    setUploadError(null);
    setImageInfo(null);
  };
  
  // RCS 버튼 추가
  const handleAddButton = () => {
    if (rcsButtons.length < 3) {
      setRcsButtons([
        ...rcsButtons,
        { buttonType: 'url', buttonName: '', buttonUrl: '' }
      ]);
    }
  };
  
  // RCS 버튼 수정
  const handleButtonChange = (index: number, field: string, value: string) => {
    const updatedButtons = [...rcsButtons];
    updatedButtons[index] = {
      ...updatedButtons[index],
      [field]: value
    };
    setRcsButtons(updatedButtons);
  };
  
  // RCS 버튼 삭제
  const handleRemoveButton = (index: number) => {
    setRcsButtons(rcsButtons.filter((_, i) => i !== index));
  };
  
  // 모달이 열릴 때 템플릿 데이터로 폼 초기화
  useEffect(() => {
    if (isOpen) {
      if (template) {
        // 수정 모드
        setTitle(template.title);
        setContent(template.content);
        setCategory(template.category);
        setMessageType(template.type);
        setImageUrl(template.imageUrl || '');
        setPreviewImage(template.imageUrl || null);
        
        // RCS 옵션 설정
        if (template.rcsOptions) {
          setRcsCardType(template.rcsOptions.cardType || 'basic');
          setRcsButtons(template.rcsOptions.buttons || []);
          setRcsThumbnails(template.rcsOptions.thumbnails || []);
          if (template.rcsOptions.productInfo) {
            setRcsProductInfo(template.rcsOptions.productInfo);
          }
        }
      } else {
        // 추가 모드 - 기본값 설정
        setTitle('');
        setContent('(광고)안녕하세요, [환자명]님. 다산바른치과입니다.');
        const activeCategories = categories.filter(c => c.isActive);
        setCategory(activeCategories.length > 0 ? activeCategories[0].id : 'discount');
        setMessageType('SMS');
        setImageUrl('');
        setPreviewImage(null);
        setImageFile(null);
        
        // RCS 옵션 초기화
        setRcsCardType('basic');
        setRcsButtons([]);
        setRcsThumbnails([]);
        setRcsProductInfo({
          productName: '',
          price: '',
          currencyUnit: '원'
        });
      }
      
      // 상태 초기화
      setIsImageUploading(false);
      setUploadError(null);
      setImageInfo(null);
      setIsSaving(false); // 저장 상태 초기화
    }
  }, [isOpen, template, categories]);
  
  // 🔥 수정된 폼 제출 처리
  const handleSubmit = async () => {
    // 필수 필드 검증
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용은 필수 입력 항목입니다.');
      return;
    }
    
    // 업로드 중인 경우 대기
    if (isImageUploading) {
      alert('이미지 업로드가 진행 중입니다. 잠시만 기다려주세요.');
      return;
    }
    
    // 이미 저장 중인 경우 중복 방지
    if (isSaving) {
      console.log('🚫 이미 저장 중입니다.');
      return;
    }
    
    // 업로드 오류가 있는 경우 확인
    if (uploadError) {
      const proceed = confirm('이미지 업로드에 실패했습니다. 이미지 없이 저장하시겠습니까?');
      if (!proceed) return;
    }
    
    // 저장 상태 설정
    setIsSaving(true);
    
    try {
      // RCS 옵션 구성
      const rcsOptions = messageType === 'RCS' ? {
        cardType: rcsCardType,
        buttons: rcsButtons.length > 0 ? rcsButtons : undefined,
        thumbnails: rcsThumbnails.length > 0 ? rcsThumbnails : undefined,
        productInfo: rcsCardType === 'commerce' ? rcsProductInfo : undefined
      } : undefined;
      
      // 최종 템플릿 객체 생성
      const finalTemplate: MessageTemplate = {
        id: template?.id || uuidv4(),
        title,
        content,
        category,
        type: messageType,
        imageUrl: (messageType === 'MMS' || messageType === 'RCS') ? imageUrl : undefined,
        rcsOptions,
        createdAt: template?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: template?.createdBy || 'current_user'
      };

      console.log('💾 템플릿 저장 시작:', finalTemplate);
      
      // 🔥 부모 컴포넌트의 저장 함수 호출 (await 추가)
      await onSave(finalTemplate);
      
      console.log('✅ 템플릿 저장 완료 - 모달 닫기');
      
      // 저장 성공 후 모달 닫기
      onClose();
      
    } catch (error) {
      console.error('❌ 템플릿 저장 실패:', error);
      alert('템플릿 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">
            {template ? '템플릿 수정' : '새 템플릿 추가'}
          </h3>
          <button
            className="text-text-secondary hover:text-text-primary"
            onClick={onClose}
            disabled={isSaving}
          >
            <Icon icon={HiOutlineX} size={20} />
          </button>
        </div>
        
        {/* 내용 영역 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 왼쪽 컬럼 - 기본 정보 */}
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  템플릿 제목
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2 border border-border rounded-md"
                  placeholder="템플릿 제목을 입력하세요"
                  disabled={isSaving}
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  카테고리
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as EventCategory)}
                  className="w-full p-2 border border-border rounded-md"
                  disabled={isSaving}
                >
                  {categories.filter(c => c.isActive).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.displayName}
                    </option>
                  ))}
                </select>
                
                {/* 선택된 카테고리 미리보기 */}
                {category && (
                  <div className="mt-2">
                    <span className={`inline-block px-2 py-1 text-xs rounded-md ${getCategoryColor(category)}`}>
                      {getCategoryDisplayName(category)}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  메시지 타입
                </label>
                <div className="flex flex-wrap gap-3">
                  {(['SMS', 'LMS', 'MMS', 'RCS'] as MessageType[]).map((type) => (
                    <label key={type} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="messageType"
                        value={type}
                        checked={messageType === type}
                        onChange={() => setMessageType(type)}
                        disabled={isSaving}
                      />
                      <span>{type}{type === 'MMS' && ' (이미지)'}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  메시지 내용
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full p-2 border border-border rounded-md min-h-[150px]"
                  placeholder="메시지 내용을 입력하세요"
                  disabled={isSaving}
                />
                <p className="text-xs text-text-secondary mt-1">
                  <span className={content.length > 90 ? 'text-red-600 font-medium' : ''}>
                    {content.length}
                  </span> / 90자 
                  {messageType === 'SMS' && content.length > 90 && (
                    <span className="text-red-600"> (SMS는 90자를 초과할 수 없습니다)</span>
                  )}
                </p>
              </div>
              
              {/* MMS 또는 RCS일 때 이미지 업로드 */}
              {(messageType === 'MMS' || messageType === 'RCS') && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    이미지 업로드
                  </label>
                  
                  {/* 업로드 오류 표시 */}
                  {uploadError && (
                    <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                      ❌ {uploadError}
                    </div>
                  )}
                  
                  {previewImage ? (
                    <div className="relative">
                      <img
                        src={previewImage}
                        alt="이미지 미리보기"
                        className="w-full h-48 object-cover rounded-md"
                      />
                      
                      {/* 업로드 중 표시 */}
                      {isImageUploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-md">
                          <div className="bg-white p-3 rounded-md flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-t-orange-500 border-orange-200 rounded-full animate-spin"></div>
                            <span className="text-sm">최적화 중...</span>
                          </div>
                        </div>
                      )}
                      
                      <button
                        className="absolute top-2 right-2 p-1 bg-red-100 text-red-700 rounded-full hover:bg-red-200"
                        onClick={handleRemoveImage}
                        title="이미지 삭제"
                        disabled={isImageUploading || isSaving}
                      >
                        <Icon icon={HiOutlineTrash} size={16} />
                      </button>
                      
                      {/* 이미지 정보 표시 */}
                      {imageInfo && (
                        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                          {imageInfo.optimizedSize} · {imageInfo.dimensions}
                          {imageInfo.originalSize !== imageInfo.optimizedSize && (
                            <span className="text-green-300"> (압축됨)</span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-border rounded-md p-4 text-center">
                      <input
                        type="file"
                        id="imageUpload"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange}
                        disabled={isImageUploading || isSaving}
                      />
                      <label
                        htmlFor="imageUpload"
                        className={`flex flex-col items-center cursor-pointer ${
                          isImageUploading || isSaving ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <Icon icon={HiOutlineUpload} size={24} className="text-text-secondary mb-2" />
                        <span className="text-sm text-text-secondary">
                          {isImageUploading ? '업로드 중...' : '이미지 파일을 드래그하거나 클릭하여 업로드'}
                        </span>
                        <span className="text-xs text-text-muted mt-1">최대 1MB, JPG, PNG, GIF, WebP</span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* 오른쪽 컬럼 - RCS 옵션 (기존 코드와 동일하되 disabled 속성 추가) */}
            {messageType === 'RCS' && (
              <div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    RCS 카드 유형
                  </label>
                  <select
                    value={rcsCardType}
                    onChange={(e) => setRcsCardType(e.target.value as any)}
                    className="w-full p-2 border border-border rounded-md"
                    disabled={isSaving}
                  >
                    <option value="basic">기본</option>
                    <option value="carousel">캐러셀 (이미지 슬라이드)</option>
                    <option value="commerce">커머스 (상품 정보)</option>
                  </select>
                </div>
                
                {/* RCS 관련 필드들도 disabled 속성 추가 필요 */}
                {/* ... 나머지 RCS 관련 코드는 기존과 동일하되 disabled={isSaving} 추가 */}
              </div>
            )}
          </div>
          
          {/* 템플릿 미리보기 (기존 코드와 동일) */}
          <div className="mt-6 border-t border-border pt-4">
            <h4 className="text-md font-medium text-text-primary mb-3">템플릿 미리보기</h4>
            
            <div className="p-4 bg-gray-50 rounded-lg border border-border">
              {messageType === 'SMS' || messageType === 'LMS' ? (
                <div className="max-w-sm mx-auto bg-white p-4 rounded-md border border-border shadow-sm">
                  <div className="text-sm text-text-secondary whitespace-pre-line">
                    {content}
                  </div>
                  <div className="mt-2 text-xs text-text-muted text-right">
                    {messageType} · {content.length}자
                  </div>
                </div>
              ) : messageType === 'MMS' ? (
                <div className="max-w-sm mx-auto bg-white rounded-md border border-border shadow-sm overflow-hidden">
                  {previewImage && (
                    <img
                      src={previewImage}
                      alt="이미지 미리보기"
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="p-4">
                    <div className="text-sm text-text-secondary whitespace-pre-line">
                      {content}
                    </div>
                    <div className="mt-2 text-xs text-text-muted text-right">
                      MMS · {content.length}자
                      {imageInfo && (
                        <span className="ml-2 text-green-600">
                          · {imageInfo.optimizedSize}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-w-sm mx-auto bg-white rounded-md border border-border shadow-sm overflow-hidden">
                  {previewImage && (
                    <img
                      src={previewImage}
                      alt="이미지 미리보기"
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="p-4">
                    <div className="text-sm text-text-secondary whitespace-pre-line">
                      {content}
                    </div>
                    
                    {/* RCS 버튼 미리보기 */}
                    {rcsButtons.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border grid gap-2">
                        {rcsButtons.map((btn, idx) => (
                          <button
                            key={idx}
                            className="w-full py-2 text-center bg-orange-50 text-orange-700 rounded-md text-sm"
                          >
                            {btn.buttonName || '버튼 이름'}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    <div className="mt-2 text-xs text-text-muted text-right">
                      RCS · {rcsCardType} 카드
                      {imageInfo && (
                        <span className="ml-2 text-green-600">
                          · {imageInfo.optimizedSize}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* 푸터 - 저장 버튼 */}
        <div className="px-6 py-4 border-t border-border flex justify-end">
          <button
            className="px-3 py-2 bg-gray-100 text-text-secondary rounded-md hover:bg-gray-200 transition-colors mr-2"
            onClick={onClose}
            disabled={isSaving}
          >
            취소
          </button>
          <button
            className={`px-4 py-2 rounded-md transition-colors flex items-center gap-1.5 ${
              isImageUploading || isSaving
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                : 'bg-orange-600 text-white hover:bg-orange-700'
            }`}
            onClick={handleSubmit}
            disabled={isImageUploading || isSaving}
          >
            <Icon icon={HiOutlineSave} size={16} />
            {isSaving ? '저장 중...' : isImageUploading ? '업로드 중...' : '템플릿 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}