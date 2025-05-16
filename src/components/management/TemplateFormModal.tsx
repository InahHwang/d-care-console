'use client'

import { useState, useEffect } from 'react'
import { 
  HiOutlineX, 
  HiOutlineSave,
  HiOutlineUpload,
  HiOutlineTrash,
  HiOutlinePlus
} from 'react-icons/hi'
import { Icon } from '../common/Icon'
import { MessageTemplate, MessageType } from '@/types/messageLog'
import { EventCategory } from '@/store/slices/patientsSlice'
import { v4 as uuidv4 } from 'uuid'

interface TemplateFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: MessageTemplate) => void;
  template: MessageTemplate | null;
}

export default function TemplateFormModal({
  isOpen,
  onClose,
  onSave,
  template
}: TemplateFormModalProps) {
  // 폼 상태
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<EventCategory>('discount');
  const [messageType, setMessageType] = useState<MessageType>('SMS');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
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
  
  // 이미지 업로드 처리
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      
      // 이미지 미리보기 생성
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // 이미지 삭제
  const handleRemoveImage = () => {
    setImageFile(null);
    setPreviewImage(null);
    setImageUrl('');
  };
  
  // RCS 버튼 추가
  const handleAddButton = () => {
    if (rcsButtons.length < 3) { // 최대 3개 버튼 제한
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
        setContent('안녕하세요, [환자명]님. [병원명]입니다.');
        setCategory('discount');
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
    }
  }, [isOpen, template]);
  
  // 폼 제출 처리
  const handleSubmit = async () => {
    // 필수 필드 검증
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용은 필수 입력 항목입니다.');
      return;
    }
    
    let finalImageUrl = imageUrl;
    
    // 이미지 파일이 있으면 업로드 처리
    if (imageFile) {
      try {
        // 이미지 업로드를 위한 FormData 생성
        const formData = new FormData();
        formData.append('file', imageFile);
        
        // 이미지 업로드 API 호출
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          throw new Error('이미지 업로드에 실패했습니다.');
        }
        
        const data = await response.json();
        finalImageUrl = data.imageUrl;
      } catch (error) {
        console.error('이미지 업로드 오류:', error);
        alert('이미지 업로드 중 오류가 발생했습니다.');
        return;
      }
    }
    
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
      imageUrl: (messageType === 'MMS' || messageType === 'RCS') ? finalImageUrl : undefined,
      rcsOptions,
      createdAt: template?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: template?.createdBy || 'current_user' // 실제 인증된 사용자 ID로 대체해야 함
    };
    
    // 저장 콜백 호출
    onSave(finalTemplate);
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
                >
                  <option value="discount">할인/프로모션</option>
                  <option value="new_treatment">신규 치료</option>
                  <option value="checkup">정기 검진</option>
                  <option value="seasonal">계절 이벤트</option>
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  메시지 타입
                </label>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="messageType"
                      value="SMS"
                      checked={messageType === 'SMS'}
                      onChange={() => setMessageType('SMS')}
                    />
                    <span>SMS</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="messageType"
                      value="LMS"
                      checked={messageType === 'LMS'}
                      onChange={() => setMessageType('LMS')}
                    />
                    <span>LMS</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="messageType"
                      value="MMS"
                      checked={messageType === 'MMS'}
                      onChange={() => setMessageType('MMS')}
                    />
                    <span>MMS (이미지)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="messageType"
                      value="RCS"
                      checked={messageType === 'RCS'}
                      onChange={() => setMessageType('RCS')}
                    />
                    <span>RCS</span>
                  </label>
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
                  
                  {previewImage ? (
                    <div className="relative">
                      <img
                        src={previewImage}
                        alt="이미지 미리보기"
                        className="w-full h-48 object-cover rounded-md"
                      />
                      <button
                        className="absolute top-2 right-2 p-1 bg-red-100 text-red-700 rounded-full"
                        onClick={handleRemoveImage}
                        title="이미지 삭제"
                      >
                        <Icon icon={HiOutlineTrash} size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-border rounded-md p-4 text-center">
                      <input
                        type="file"
                        id="imageUpload"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange}
                      />
                      <label
                        htmlFor="imageUpload"
                        className="flex flex-col items-center cursor-pointer"
                      >
                        <Icon icon={HiOutlineUpload} size={24} className="text-text-secondary mb-2" />
                        <span className="text-sm text-text-secondary">이미지 파일을 드래그하거나 클릭하여 업로드</span>
                        <span className="text-xs text-text-muted mt-1">최대 1MB, JPG, PNG, GIF</span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* 오른쪽 컬럼 - RCS 옵션 */}
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
                  >
                    <option value="basic">기본</option>
                    <option value="carousel">캐러셀 (이미지 슬라이드)</option>
                    <option value="commerce">커머스 (상품 정보)</option>
                  </select>
                </div>
                
                {/* 커머스 카드일 때 상품 정보 */}
                {rcsCardType === 'commerce' && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-md">
                    <h4 className="font-medium text-sm mb-2">상품 정보</h4>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-text-secondary mb-1">
                          상품명
                        </label>
                        <input
                          type="text"
                          value={rcsProductInfo.productName}
                          onChange={(e) => setRcsProductInfo({
                            ...rcsProductInfo,
                            productName: e.target.value
                          })}
                          className="w-full p-2 text-sm border border-border rounded-md"
                          placeholder="상품명을 입력하세요"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-text-secondary mb-1">
                            가격
                          </label>
                          <input
                            type="text"
                            value={rcsProductInfo.price}
                            onChange={(e) => setRcsProductInfo({
                              ...rcsProductInfo,
                              price: e.target.value
                            })}
                            className="w-full p-2 text-sm border border-border rounded-md"
                            placeholder="가격을 입력하세요"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-text-secondary mb-1">
                            통화 단위
                          </label>
                          <select
                            value={rcsProductInfo.currencyUnit}
                            onChange={(e) => setRcsProductInfo({
                              ...rcsProductInfo,
                              currencyUnit: e.target.value
                            })}
                            className="w-full p-2 text-sm border border-border rounded-md"
                          >
                            <option value="원">원</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* 버튼 설정 */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-text-secondary">
                      RCS 버튼 (최대 3개)
                    </label>
                    <button
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      onClick={handleAddButton}
                      disabled={rcsButtons.length >= 3}
                    >
                      <Icon icon={HiOutlinePlus} size={12} />
                      버튼 추가
                    </button>
                  </div>
                  
                  {rcsButtons.length === 0 ? (
                    <div className="p-4 bg-gray-50 text-center rounded-md">
                      <p className="text-sm text-text-secondary">
                        추가된 버튼이 없습니다.
                      </p>
                      <button
                        className="mt-2 px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200"
                        onClick={handleAddButton}
                      >
                        버튼 추가하기
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rcsButtons.map((button, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-md">
                          <div className="flex justify-between mb-2">
                            <span className="text-xs font-medium">버튼 {index + 1}</span>
                            <button
                              className="text-red-600 hover:text-red-800"
                              onClick={() => handleRemoveButton(index)}
                            >
                              <Icon icon={HiOutlineTrash} size={14} />
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div>
                              <label className="block text-xs text-text-secondary mb-1">
                                버튼 이름
                              </label>
                              <input
                                type="text"
                                value={button.buttonName}
                                onChange={(e) => handleButtonChange(index, 'buttonName', e.target.value)}
                                className="w-full p-2 text-sm border border-border rounded-md"
                                placeholder="버튼 텍스트"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-text-secondary mb-1">
                                버튼 유형
                              </label>
                              <select
                                value={button.buttonType}
                                onChange={(e) => handleButtonChange(index, 'buttonType', e.target.value)}
                                className="w-full p-2 text-sm border border-border rounded-md"
                              >
                                <option value="url">URL 링크</option>
                                <option value="phone">전화 걸기</option>
                                <option value="map">지도 보기</option>
                              </select>
                            </div>
                          </div>
                          
                          {button.buttonType === 'url' && (
                            <div>
                              <label className="block text-xs text-text-secondary mb-1">
                                URL
                              </label>
                              <input
                                type="text"
                                value={button.buttonUrl || ''}
                                onChange={(e) => handleButtonChange(index, 'buttonUrl', e.target.value)}
                                className="w-full p-2 text-sm border border-border rounded-md"
                                placeholder="https://example.com"
                              />
                            </div>
                          )}
                          
                          {button.buttonType === 'phone' && (
                            <div>
                              <label className="block text-xs text-text-secondary mb-1">
                                전화번호
                              </label>
                              <input
                                type="text"
                                value={button.phoneNumber || ''}
                                onChange={(e) => handleButtonChange(index, 'phoneNumber', e.target.value)}
                                className="w-full p-2 text-sm border border-border rounded-md"
                                placeholder="02-1234-5678"
                              />
                            </div>
                          )}
                          
                          {button.buttonType === 'map' && (
                            <div>
                              <label className="block text-xs text-text-secondary mb-1">
                                주소
                              </label>
                              <input
                                type="text"
                                value={button.address || ''}
                                onChange={(e) => handleButtonChange(index, 'address', e.target.value)}
                                className="w-full p-2 text-sm border border-border rounded-md"
                                placeholder="서울시 강남구 테헤란로 123"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* 캐러셀 이미지 업로드 (추가 구현 필요) */}
                {rcsCardType === 'carousel' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      캐러셀 이미지 (최대 5개)
                    </label>
                    <p className="text-xs text-text-muted mb-2">
                      이미지 업로드 기능은 아직 구현되지 않았습니다. API 연동 시 추가 개발이 필요합니다.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* 템플릿 미리보기 */}
          <div className="mt-6 border-t border-border pt-4">
            <h4 className="text-md font-medium text-text-primary mb-3">템플릿 미리보기</h4>
            
            <div className="p-4 bg-gray-50 rounded-lg border border-border">
              {/* 메시지 타입에 따른 미리보기 */}
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
                            className="w-full py-2 text-center bg-blue-50 text-blue-700 rounded-md text-sm"
                          >
                            {btn.buttonName || '버튼 이름'}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    <div className="mt-2 text-xs text-text-muted text-right">
                      RCS · {rcsCardType} 카드
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
          >
            취소
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1.5"
            onClick={handleSubmit}
          >
            <Icon icon={HiOutlineSave} size={16} />
            템플릿 저장
          </button>
        </div>
      </div>
    </div>
  );
}