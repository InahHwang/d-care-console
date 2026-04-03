// src/components/management/MessageSendModal.tsx

'use client'

import { useState, useEffect } from 'react'
import { 
  HiOutlineX, 
  HiOutlinePaperAirplane,
  HiOutlineDocumentText,
  HiOutlineTemplate,
  HiOutlineCheck,
  HiOutlineFilter,
  HiOutlinePhotograph
} from 'react-icons/hi'
import { Icon } from '../common/Icon'
import { Patient } from '@/types/patient'
import { EventCategory } from '@/types/messageLog'
import { MessageType, MessageTemplate } from '@/types/messageLog';
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks';
import { fetchCategories } from '@/store/slices/categoriesSlice';
import { getEventCategoryOptions, getCategoryDisplayName } from '@/utils/categoryUtils';
import { 
  saveMessageLog, 
  saveMessageLogs, 
  addMessageLog,
  selectPatientLogs
} from '@/store/slices/messageLogsSlice';
import { createMessageLog, personalizeMessageContent } from '@/utils/messageLogUtils';
import { MessageLog } from '@/types/messageLog';
import { fetchTemplates } from '@/store/slices/templatesSlice';
import { RootState } from '@/store';
import { useActivityLogger } from '@/hooks/useActivityLogger' 

// 모달 Props
interface MessageSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPatients: Patient[];
  onSendComplete: () => void;
}

export default function MessageSendModal({ 
  isOpen, 
  onClose, 
  selectedPatients, 
  onSendComplete 
}: MessageSendModalProps) {
  const [step, setStep] = useState<'template' | 'edit' | 'confirm' | 'result'>('template')
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null)
  const [messageContent, setMessageContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSendComplete, setIsSendComplete] = useState(false)
  const [activeCategory, setActiveCategory] = useState<EventCategory | 'all'>('all') // 카테고리 필터 추가
  const [sendResult, setSendResult] = useState<{
    success: number;
    failed: number;
    total: number;
    failedPatients: { name: string; reason: string }[];
  }>({ success: 0, failed: 0, total: 0, failedPatients: [] })

  const dispatch = useAppDispatch();

  const { logMessageAction } = useActivityLogger()
  // 템플릿과 카테고리 스토어에서 데이터 가져오기
  const { templates, isLoading: templatesLoading } = useAppSelector(
    (state: RootState) => state.templates
  );
  const { categories } = useAppSelector((state: RootState) => state.categories); 

  // 컴포넌트 마운트시 템플릿과 카테고리 불러오기
  useEffect(() => {
    if (isOpen) {
      dispatch(fetchTemplates());
      dispatch(fetchCategories()); 
    }
  }, [dispatch, isOpen]);

  // 템플릿과 카테고리에서 카테고리 옵션 가져오기 - 수정된 부분
  const eventCategoryOptions = getEventCategoryOptions(templates, categories);

  // 선택된 카테고리와 환자 카테고리에 맞는 템플릿 필터링 - 수정된 부분
  const getFilteredTemplates = () => {
    // 먼저 카테고리 필터 적용
    let filteredByCategory = templates;
    if (activeCategory !== 'all') {
      filteredByCategory = templates.filter(template => 
        template.category === activeCategory
      );
    }

    // 선택된 환자가 없으면 카테고리 필터링만 적용
    if (selectedPatients.length === 0) return filteredByCategory;

    // 환자의 카테고리가 있는 경우, 환자 카테고리 필터 적용
    if (activeCategory === 'all') {
      // 선택된 환자들의 모든 카테고리 수집
      const patientCategories = new Set<EventCategory>();
      selectedPatients.forEach(patient => {
        if (patient && patient.eventTargetInfo?.categories) {
          patient.eventTargetInfo.categories.forEach(category => {
            if (category) patientCategories.add(category);
          });
        }
      });

      // 환자에게 설정된 카테고리가 있으면 필터링
      if (patientCategories.size > 0) {
        return filteredByCategory.filter(template => 
          template.category && patientCategories.has(template.category as EventCategory)
        );
      }
    }
    
    return filteredByCategory;
  }

  // 템플릿 선택 핸들러
  const handleSelectTemplate = (template: MessageTemplate) => {
    // 🔥 템플릿 선택 로깅
    if (selectedPatients.length > 0) {
      const patientNames = selectedPatients.map(p => p.name).join(', ')
      logMessageAction(
        'message_template_used',
        selectedPatients[0].id,
        `템플릿 선택: ${patientNames}`,
        {
          templateId: template.id,
          templateName: template.title,
          templateType: template.type,
          templateCategory: template.category,
          recipientCount: selectedPatients.length,
          notes: `${template.title} 템플릿 선택`
        }
      ).catch(error => console.warn('활동 로그 기록 실패:', error))
    }
    setSelectedTemplate(template);
    
    // 환자명 치환 처리 (다중 선택 시)
    let content = template.content;
    
    if (selectedPatients.length === 1) {
      // 단일 환자인 경우 이름 직접 치환
      content = content.replace(/\[환자명\]/g, selectedPatients[0]?.name || '고객');
    } else {
      // 다중 환자인 경우 환자명 제거
      content = content.replace(/\[환자명\]님/g, '고객님');
    }
    
    // 병원명 치환 (실제로는 설정에서 가져와야 함)
    const hospitalName = process.env.NEXT_PUBLIC_HOSPITAL_NAME || '디케어 치과';
    content = content.replace(/\[병원명\]/g, hospitalName);
    
    setMessageContent(content);
    setStep('edit');
  }

  // 문자 내용 미리보기 생성
  const getPreviewContent = (patient: Patient) => {
    if (!messageContent || !patient) return '';
    
    let content = messageContent;
    
    // 특정 환자명으로 치환 - 더 정확한 치환 방식 적용
    content = content.replace(/\[환자명\]/g, patient.name || '고객');
    content = content.replace(/고객님/g, `${patient.name || '고객'}님`);
    
    // 병원명 치환
    const hospitalName = process.env.NEXT_PUBLIC_HOSPITAL_NAME || '디케어 치과';
    content = content.replace(/\[병원명\]/g, hospitalName);
    
    return content;
  }

  // 문자 발송 처리
  const handleSendMessages = async () => {
  if (selectedPatients.length === 0) return;
  
  setIsLoading(true);
  setStep('confirm');
  
  try {
    console.log('메시지 발송 시작 - 선택된 환자 수:', selectedPatients.length);
     // 🔥 메시지 발송 시작 로깅
      await logMessageAction(
        'message_send',
        selectedPatients[0].id,
        `메시지 발송 시작 (${selectedPatients.length}명)`,
        {
          templateName: selectedTemplate?.title,
          messageType: selectedTemplate?.type || 'SMS',
          recipientCount: selectedPatients.length,
          patientIds: selectedPatients.map(p => p.id),
          patientNames: selectedPatients.map(p => p.name),
          notes: '메시지 발송 프로세스 시작'
        }
      ).catch(error => console.warn('활동 로그 기록 실패:', error))

    const messageLogs: MessageLog[] = [];
    
    const responses = await Promise.all(
      selectedPatients.map(async (patient) => {
        if (!patient || !patient.id || !patient.name || !patient.phoneNumber) {
          // 🔥 환자 정보 오류 로깅
            await logMessageAction(
              'message_send',
              patient?.id || 'unknown',
              patient?.name || '알 수 없음',
              {
                error: '환자 정보 오류',
                templateName: selectedTemplate?.title,
                notes: '환자 정보가 올바르지 않아 메시지 발송 실패'
              }
            ).catch(error => console.warn('활동 로그 기록 실패:', error))

          return { 
            patient: { name: patient?.name || '알 수 없음', id: patient?.id || 'unknown' }, 
            success: false, 
            reason: '환자 정보 오류' 
          };
        }

        try {
          const personalizedContent = getPreviewContent(patient);
          
          const msgType: MessageType = selectedTemplate?.type || 
            (personalizedContent.length > 90 ? 'LMS' : 'SMS');
          
          const requestBody: Record<string, any> = {
            phoneNumber: patient.phoneNumber,
            content: personalizedContent,
            messageType: msgType
          };
          
          // MMS 또는 RCS인 경우 이미지 URL 처리 개선
          if ((msgType === 'MMS' || msgType === 'RCS') && selectedTemplate?.imageUrl) {
            let imageUrlToSend = selectedTemplate.imageUrl;
            
            console.log(`🖼️ [${patient.name}] 원본 이미지 URL:`, imageUrlToSend);
            
            // Base64 데이터 URL이 아닌 경우 (파일 경로인 경우)
            if (!imageUrlToSend.startsWith('data:image/')) {
              // 상대 경로를 절대 URL로 변환하지 않고 그대로 전송
              // 서버에서 public 폴더 기준으로 처리하도록 함
              if (imageUrlToSend.startsWith('/')) {
                // 이미 올바른 상대 경로 형태
                console.log(`📁 [${patient.name}] 상대 경로 이미지:`, imageUrlToSend);
              } else {
                // uploads/ 등으로 시작하는 경우 앞에 / 추가
                imageUrlToSend = '/' + imageUrlToSend;
                console.log(`📁 [${patient.name}] 경로 수정:`, imageUrlToSend);
              }
            } else {
              console.log(`💾 [${patient.name}] Base64 이미지 데이터 사용`);
            }
            
            requestBody.imageUrl = imageUrlToSend;
            requestBody.messageType = 'MMS'; // 명시적으로 MMS 타입 지정
            
            console.log(`🎯 [${patient.name}] 최종 이미지 URL:`, imageUrlToSend.substring(0, 50) + '...');
          }
          
          // RCS인 경우 버튼 정보 추가
          if (msgType === 'RCS' && selectedTemplate?.rcsOptions) {
            requestBody.rcsOptions = selectedTemplate.rcsOptions;
          }
          
          console.log(`📤 [${patient.name}] 요청 데이터:`, {
            phoneNumber: requestBody.phoneNumber,
            messageType: requestBody.messageType,
            contentLength: requestBody.content.length,
            hasImageUrl: !!requestBody.imageUrl,
            imageUrlType: requestBody.imageUrl ? 
              (requestBody.imageUrl.startsWith('data:') ? 'base64' : 'path') : 'none'
          });
          
          // 실제 메시지 발송 API 호출
          const response = await fetch('/api/messages/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(30000),
          });
          
          // 응답 처리
          if (!response.ok) {
            const errorData = await response.json();

            // 🔥 메시지 발송 실패 로깅
              await logMessageAction(
                'message_send',
                patient.id,
                patient.name,
                {
                  error: errorData.message || `상태 코드: ${response.status}`,
                  messageType: msgType,
                  templateName: selectedTemplate?.title,
                  phoneNumber: patient.phoneNumber,
                  notes: '메시지 발송 실패'
                }
              ).catch(error => console.warn('활동 로그 기록 실패:', error))
            
            // 실패 로그 생성
            const messageId = `fail_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${patient.id.substring(0, 8)}`;
            const failedLog = createMessageLog(
              patient,
              personalizedContent,
              msgType,
              'failed',
              {
                templateName: selectedTemplate?.title,
                category: selectedTemplate?.category,
                messageId: messageId,
                errorMessage: errorData.message || `상태 코드: ${response.status}`,
                operator: '관리자',
                imageUrl: selectedTemplate?.imageUrl,
                rcsOptions: selectedTemplate?.rcsOptions
              }
            );

            messageLogs.push(failedLog);
            
            return { 
              patient, 
              success: false,
              reason: errorData.message || `상태 코드: ${response.status}`
            };
          } else {
            const responseData = await response.json();
            // 🔥 메시지 발송 성공 로깅
              await logMessageAction(
                'message_send',
                patient.id,
                patient.name,
                {
                  messageId: responseData.messageId,
                  messageType: responseData.actualType || msgType,
                  templateName: selectedTemplate?.title,
                  phoneNumber: patient.phoneNumber,
                  contentLength: personalizedContent.length,
                  hasImage: !!(selectedTemplate?.imageUrl),
                  notes: '메시지 발송 성공'
                }
              ).catch(error => console.warn('활동 로그 기록 실패:', error))
            
            console.log(`✅ [${patient.name}] 발송 성공:`, responseData);
            
            // 실제 발송된 타입 확인 (서버에서 MMS가 LMS로 변경되었을 수도 있음)
            const actualMessageType = responseData.actualType || msgType;
            
            // 성공 로그 생성
            const messageId = responseData.messageId || `success_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${patient.id.substring(0, 8)}`;
            const successLog = createMessageLog(
              patient,
              personalizedContent,
              actualMessageType, // 실제 발송된 타입 사용
              'success',
              {
                templateName: selectedTemplate?.title,
                category: selectedTemplate?.category,
                messageId: messageId,
                operator: '관리자',
                imageUrl: actualMessageType === 'MMS' ? selectedTemplate?.imageUrl : undefined, // MMS가 아니면 이미지 URL 제거
                rcsOptions: selectedTemplate?.rcsOptions
              }
            );
            
            messageLogs.push(successLog);
            
            return { patient, success: true, reason: '' };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
          // 🔥 메시지 발송 예외 로깅
            await logMessageAction(
              'message_send',
              patient.id,
              patient.name,
              {
                error: errorMessage,
                templateName: selectedTemplate?.title,
                phoneNumber: patient.phoneNumber,
                notes: '메시지 발송 중 예외 발생'
              }
            ).catch(error => console.warn('활동 로그 기록 실패:', error))

          console.error(`❌ [${patient.name}] 메시지 발송 실패:`, errorMessage);
          
          // 예외 로그 생성
          const msgType: MessageType = selectedTemplate?.type || 
            (getPreviewContent(patient).length > 90 ? 'LMS' : 'SMS');
            
          const messageId = `error_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${patient.id.substring(0, 8)}`;
          const errorLog = createMessageLog(
            patient,
            getPreviewContent(patient),
            msgType,
            'failed',
            {
              templateName: selectedTemplate?.title,
              category: selectedTemplate?.category,
              messageId: messageId,
              errorMessage: errorMessage,
              operator: '관리자',
              imageUrl: selectedTemplate?.imageUrl,
              rcsOptions: selectedTemplate?.rcsOptions
            }
          );
          
          messageLogs.push(errorLog);
                      
          return { 
            patient, 
            success: false,
            reason: errorMessage
          };
        }
      })
    );
    
    // 나머지 코드는 동일...
    const successCount = responses.filter(r => r.success).length;
    const failedResponses = responses.filter(r => !r.success);

    // 🔥 메시지 발송 완료 로깅
      await logMessageAction(
        'message_send',
        selectedPatients[0].id,
        `메시지 발송 완료 (${selectedPatients.length}명)`,
        {
          templateName: selectedTemplate?.title,
          totalRecipients: selectedPatients.length,
          successCount: successCount,
          failedCount: failedResponses.length,
          successRate: `${Math.round((successCount / selectedPatients.length) * 100)}%`,
          notes: `메시지 발송 완료 - 성공: ${successCount}건, 실패: ${failedResponses.length}건`
        }
      ).catch(error => console.warn('활동 로그 기록 실패:', error))
        
    setSendResult({
      success: successCount,
      failed: selectedPatients.length - successCount,
      total: selectedPatients.length,
      failedPatients: failedResponses.map(r => ({ 
        name: r.patient.name || '알 수 없음', 
        reason: r.reason 
      }))
    });
    
    setIsSendComplete(true);
    setStep('result');
    onSendComplete();

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('메시지 발송 중 오류 발생:', errorMessage);

    // 🔥 메시지 발송 전체 실패 로깅
      await logMessageAction(
        'message_send',
        selectedPatients[0]?.id || 'unknown',
        `메시지 발송 전체 실패 (${selectedPatients.length}명)`,
        {
          error: errorMessage,
          templateName: selectedTemplate?.title,
          totalRecipients: selectedPatients.length,
          notes: '메시지 발송 프로세스 전체 실패'
        }
      ).catch(error => console.warn('활동 로그 기록 실패:', error))
    
    setSendResult({
      success: 0,
      failed: selectedPatients.length,
      total: selectedPatients.length,
      failedPatients: [{ 
        name: '전체', 
        reason: errorMessage
      }]
    });
    
    setIsSendComplete(true);
    setStep('result');
  } finally {
    setIsLoading(false);
  }
}

  // 모달 닫기 처리
  const handleClose = () => {
    // 완료 후 모달을 닫을 때 상태 초기화
    if (isSendComplete) {
      setStep('template');
      setSelectedTemplate(null);
      setMessageContent('');
      setIsSendComplete(false);
      setSendResult({ success: 0, failed: 0, total: 0, failedPatients: [] });
    }
    
    onClose();
  }

  // 모달이 열릴 때마다 상태 초기화 및 템플릿 불러오기
  useEffect(() => {
    if (isOpen) {
      setStep('template');
      setSelectedTemplate(null);
      setMessageContent('');
      setIsSendComplete(false);
      setActiveCategory('all'); // 카테고리 필터 초기화
      dispatch(fetchTemplates()); // 템플릿 데이터 불러오기
      dispatch(fetchCategories()); // 카테고리 데이터 불러오기
    }
  }, [isOpen, dispatch]);
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">
            {step === 'template' && '이벤트 메시지 발송'}
            {step === 'edit' && '메시지 내용 편집'}
            {step === 'confirm' && '메시지 발송 확인'}
            {step === 'result' && '메시지 발송 결과'}
          </h3>
          <button
            className="text-text-secondary hover:text-text-primary"
            onClick={handleClose}
            disabled={isLoading}
          >
            <Icon icon={HiOutlineX} size={20} />
          </button>
        </div>
        
        {/* 내용 영역 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 선택된 환자 정보 표시 */}
          <div className="mb-4 bg-orange-50 p-3 rounded-md">
            <p className="text-sm text-orange-800 font-medium">선택된 환자</p>
            <p className="text-orange-600 mt-1 flex items-center gap-1">
              <span className="font-medium">{selectedPatients.length}</span>
              <span>명의 환자에게 메시지를 발송합니다</span>
            </p>
            
            {selectedPatients.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedPatients.slice(0, 5).map(patient => (
                  <span 
                    key={patient.id} 
                    className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-orange-100 text-orange-800"
                  >
                    {patient.name}
                  </span>
                ))}
                {selectedPatients.length > 5 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-orange-100 text-orange-800">
                    +{selectedPatients.length - 5}명
                  </span>
                )}
              </div>
            )}
          </div>
          
          {/* 템플릿 선택 단계 */}
          {step === 'template' && (
            <div>
              <h4 className="text-md font-medium text-text-primary mb-3">메시지 템플릿 선택</h4>
              
              {/* 카테고리 필터 - 동적으로 변경 */}
              <div className="mb-4 flex flex-wrap gap-2 border-b border-gray-100 pb-3">
                <button
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeCategory === 'all'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                  }`}
                  onClick={() => setActiveCategory('all')}
                >
                  전체
                </button>
                
                {eventCategoryOptions.map(category => (
                  <button
                    key={category.value}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activeCategory === category.value
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                    }`}
                    onClick={() => setActiveCategory(category.value as EventCategory)}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
              
              {templatesLoading ? (
                <div className="text-center py-6 bg-gray-50 rounded-md">
                  <p className="text-text-secondary">템플릿 불러오는 중...</p>
                </div>
              ) : getFilteredTemplates().length === 0 ? (
                <div className="text-center py-6 bg-gray-50 rounded-md">
                  <p className="text-text-secondary">
                    선택된 카테고리에 맞는 템플릿이 없습니다.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {getFilteredTemplates().map((template: MessageTemplate) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className="text-left p-4 bg-light-bg hover:bg-gray-100 rounded-md transition-colors border border-border flex gap-3"
                    >
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center
                        ${template.type === 'SMS' ? 'bg-orange-100 text-orange-600' : 
                          template.type === 'LMS' ? 'bg-purple-100 text-purple-600' :
                          template.type === 'MMS' ? 'bg-green-100 text-green-600' : 
                          'bg-orange-100 text-orange-600'}`}
                      >
                        {template.type === 'MMS' || (template.type === 'RCS' && template.imageUrl) ? (
                          <Icon icon={HiOutlinePhotograph} size={16} />
                        ) : (
                          <Icon icon={HiOutlineTemplate} size={16} />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-medium text-text-primary">{template.title}</h5>
                          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                            {template.type}
                          </span>
                          <span className="text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded">
                            {getCategoryDisplayName(template.category, categories)}
                          </span>
                        </div>
                        <p className="text-sm text-text-secondary line-clamp-2 mt-1">
                          {template.content}
                        </p>
                        
                        {/* 이미지 미리보기 추가 (MMS 또는 RCS인 경우) */}
                        {(template.type === 'MMS' || template.type === 'RCS') && template.imageUrl && (
                          <div className="mt-2 h-14 w-14 rounded-md overflow-hidden border border-gray-200">
                            <img 
                              src={template.imageUrl} 
                              alt="템플릿 이미지" 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-400 text-xs">로드 실패</div>';
                                }
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* 메시지 편집 단계 */}
          {step === 'edit' && selectedTemplate && (
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-text-primary mb-1">
                  템플릿: {selectedTemplate.title}
                </label>
                <div className="flex items-center gap-2 text-sm">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs 
                    ${selectedTemplate.type === 'SMS' ? 'bg-orange-100 text-orange-600' : 
                      selectedTemplate.type === 'LMS' ? 'bg-purple-100 text-purple-600' :
                      selectedTemplate.type === 'MMS' ? 'bg-green-100 text-green-600' : 
                      'bg-orange-100 text-orange-600'}`}
                  >
                    {selectedTemplate.type}
                  </span>
                  <span className="inline-block px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">
                    {getCategoryDisplayName(selectedTemplate.category, categories)}
                  </span>
                  <button 
                    className="text-orange-600 hover:text-orange-800 underline text-xs"
                    onClick={() => setStep('template')}
                  >
                    다른 템플릿 선택
                  </button>
                </div>
              </div>
              
              {/* MMS/RCS 이미지 표시 */}
              {(selectedTemplate.type === 'MMS' || selectedTemplate.type === 'RCS') && selectedTemplate.imageUrl && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    이미지
                  </label>
                  <div className="relative">
                    <div className="w-full h-40 bg-gray-100 rounded-lg overflow-hidden">
                      <img 
                        src={selectedTemplate.imageUrl} 
                        alt="메시지 이미지" 
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-400">이미지를 불러올 수 없습니다</div>';
                          }
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    이미지는 MMS로 함께 전송됩니다.
                  </p>
                </div>
              )}
              
              {/* RCS 버튼 표시 */}
              {selectedTemplate.type === 'RCS' && selectedTemplate.rcsOptions?.buttons && selectedTemplate.rcsOptions.buttons.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    RCS 버튼
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.rcsOptions.buttons.map((btn, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-gray-100 text-text-primary text-sm rounded-md">
                        {btn.buttonName}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    버튼은 RCS 메시지에만 표시됩니다.
                  </p>
                </div>
              )}
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-text-primary mb-1">
                  메시지 내용 편집
                </label>
                <div className="relative">
                  <textarea 
                    value={messageContent} 
                    onChange={(e) => setMessageContent(e.target.value)}
                    className="form-input min-h-[200px] text-base"
                    placeholder="메시지 내용을 입력하세요..."
                  />
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  <span className={messageContent.length > 90 ? 'text-red-600 font-medium' : ''}>
                    {messageContent.length}
                  </span> / 90자 
                  {selectedTemplate.type !== 'SMS' ? (
                    <span> (LMS/MMS/RCS는 장문 발송 가능)</span>
                  ) : (
                    <span> (90자 이상은 LMS로 발송되며 추가 요금이 부과될 수 있습니다)</span>
                  )}
                </p>
              </div>
              
              <div className="mt-6">
                <h5 className="text-sm font-medium text-text-primary mb-2">
                  메시지 미리보기
                </h5>
                <div className="border border-border rounded-md p-4 bg-gray-50">
                  {selectedPatients.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 max-h-[200px] overflow-y-auto pr-2">
                      {selectedPatients.slice(0, 3).map(patient => (
                        <div key={patient.id} className="bg-white p-3 rounded-md border border-border">
                          <p className="text-xs text-text-secondary mb-1">
                            수신자: {patient.name} ({patient.phoneNumber})
                          </p>
                          
                          {/* 이미지 미리보기 (MMS/RCS) */}
                          {(selectedTemplate.type === 'MMS' || selectedTemplate.type === 'RCS') && selectedTemplate.imageUrl && (
                            <div className="mb-2 w-12 h-12 rounded-md overflow-hidden border border-gray-200">
                              <img 
                                src={selectedTemplate.imageUrl} 
                                alt="메시지 이미지" 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          
                          <p className="text-sm text-text-primary whitespace-pre-line">
                            {getPreviewContent(patient)}
                          </p>
                          
                          {/* RCS 버튼 미리보기 */}
                          {selectedTemplate.type === 'RCS' && selectedTemplate.rcsOptions?.buttons && selectedTemplate.rcsOptions.buttons.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <div className="flex flex-wrap gap-1">
                                {selectedTemplate.rcsOptions.buttons.map((btn, idx) => (
                                  <span key={idx} className="px-2 py-0.5 bg-gray-100 text-text-secondary text-xs rounded">
                                    {btn.buttonName}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {selectedPatients.length > 3 && (
                        <p className="text-xs text-text-secondary">
                          외 {selectedPatients.length - 3}명의 환자에게 발송됩니다.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-text-secondary py-2">
                      선택된 환자가 없습니다.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* 발송 확인 단계 */}
          {step === 'confirm' && (
            <div className="text-center">
              <div className="animate-pulse mb-6">
                <div className="w-16 h-16 mx-auto rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Icon icon={HiOutlinePaperAirplane} size={32} />
                </div>
                <h4 className="text-lg font-medium text-text-primary mt-4">
                  메시지 발송 중...
                </h4>
                <p className="text-text-secondary mt-2">
                  {selectedPatients.length}명의 환자에게 메시지를 발송하고 있습니다.
                </p>
              </div>
              
              <div className="w-full max-w-xs mx-auto bg-gray-100 rounded-full h-2.5 mt-8">
                <div className="bg-orange-600 h-2.5 rounded-full animate-[loadingProgress_1.5s_ease-in-out]"></div>
              </div>
            </div>
          )}
          
          {/* 결과 표시 단계 */}
          {step === 'result' && (
            <div className="text-center">
              {sendResult.success > 0 ? (
                <div className="w-16 h-16 mx-auto rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                  <Icon icon={HiOutlineCheck} size={32} />
                </div>
              ) : (
                <div className="w-16 h-16 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                  <Icon icon={HiOutlineX} size={32} />
                </div>
              )}
              
              <h4 className="text-lg font-medium text-text-primary mt-4">
                메시지 발송 완료
              </h4>
              
              <div className="max-w-sm mx-auto mt-6 bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-text-secondary">총 대상자</p>
                    <p className="text-lg font-semibold text-text-primary mt-1">
                      {sendResult.total}명
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-green-600">발송 성공</p>
                    <p className="text-lg font-semibold text-green-600 mt-1">
                      {sendResult.success}명
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-red-600">발송 실패</p>
                    <p className="text-lg font-semibold text-red-600 mt-1">
                      {sendResult.failed}명
                    </p>
                  </div>
                </div>
              </div>
              
              {sendResult.failed > 0 && (
                <div className="mt-4 text-left max-w-sm mx-auto bg-red-50 p-3 rounded-md border border-red-200">
                  <p className="text-sm font-medium text-red-700 mb-2">
                    발송 실패 목록
                  </p>
                  <div className="text-sm text-red-600 max-h-[150px] overflow-y-auto">
                    {sendResult.failedPatients.map((patient, index) => (
                      <div key={index} className="mb-1 pb-1 border-b border-red-100 last:border-0">
                        <span className="font-medium">{patient.name}</span>: {patient.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <p className="text-sm text-text-secondary mt-6">
                발송 내역은 '문자 발송 내역' 메뉴에서 확인할 수 있습니다.
              </p>
            </div>
          )}
        </div>
        
        {/* 푸터 영역 */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          {step === 'template' && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleClose}
            >
              취소
            </button>
          )}
          
          {step === 'edit' && (
            <>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setStep('template')}
              >
                이전
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSendMessages}
                disabled={!messageContent.trim() || selectedPatients.length === 0}
              >
                <Icon icon={HiOutlinePaperAirplane} size={16} className="mr-1" />
                메시지 발송
              </button>
            </>
          )}
          
          {step === 'result' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleClose}
            >
              완료
            </button>
          )}
        </div>
      </div>
      
      {/* CSS 애니메이션 */}
      <style jsx global>{`
        @keyframes loadingProgress {
          0% { width: 0% }
          100% { width: 100% }
        }
      `}</style>
    </div>
  )
}