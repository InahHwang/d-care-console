// src/store/slices/templatesSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '@/store'
import { MessageTemplate } from '@/types/messageLog'
import api from '@/utils/api'

// 초기 상태 인터페이스
interface TemplatesState {
  templates: MessageTemplate[];
  isLoading: boolean;
  error: string | null;
}

// API에서 템플릿 목록 가져오기
export const fetchTemplates = createAsyncThunk(
  'templates/fetchTemplates',
  async (_, { rejectWithValue }) => {
    try {
      console.log('🔍 fetchTemplates: API로 템플릿 목록 조회 시작');
      
      const response = await api.get('/v2/templates');
      
      if (response.data.success) {
        console.log('✅ fetchTemplates: 템플릿 조회 성공:', response.data.data.length, '개');
        return response.data.data as MessageTemplate[];
      } else {
        throw new Error(response.data.message || '템플릿 조회에 실패했습니다.');
      }
      
    } catch (error: any) {
      console.error('❌ fetchTemplates: 템플릿 조회 오류:', error);
      
      // 네트워크 오류나 서버 오류 시 localStorage 백업 사용
      if (error.code === 'ERR_NETWORK' || error.response?.status >= 500) {
        console.log('🔄 fetchTemplates: 서버 오류로 localStorage 백업 사용');
        try {
          const storedTemplates = localStorage.getItem('messageTemplates');
          if (storedTemplates) {
            const parsedTemplates = JSON.parse(storedTemplates) as MessageTemplate[];
            console.log('📦 fetchTemplates: localStorage에서 백업 데이터 로드:', parsedTemplates.length, '개');
            return parsedTemplates;
          }
        } catch (localError) {
          console.error('❌ fetchTemplates: localStorage 백업 로드 실패:', localError);
        }
      }
      
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        '템플릿을 불러오는 중 오류가 발생했습니다.'
      );
    }
  }
);

// 템플릿 추가
export const addTemplate = createAsyncThunk(
  'templates/addTemplate',
  async (template: MessageTemplate, { rejectWithValue }) => {
    try {
      console.log('➕ addTemplate: API로 템플릿 추가 시작:', template.title);
      
      const response = await api.post('/v2/templates', template);
      
      if (response.data.success) {
        console.log('✅ addTemplate: 템플릿 추가 성공');
        
        // 성공 시 localStorage에도 백업 저장
        try {
          const storedTemplates = localStorage.getItem('messageTemplates');
          const currentTemplates = storedTemplates ? JSON.parse(storedTemplates) : [];
          const updatedTemplates = [template, ...currentTemplates];
          localStorage.setItem('messageTemplates', JSON.stringify(updatedTemplates));
          console.log('💾 addTemplate: localStorage 백업 저장 완료');
        } catch (localError) {
          console.warn('⚠️ addTemplate: localStorage 백업 저장 실패:', localError);
        }
        
        return response.data.data as MessageTemplate;
      } else {
        throw new Error(response.data.message || '템플릿 추가에 실패했습니다.');
      }
      
    } catch (error: any) {
      console.error('❌ addTemplate: 템플릿 추가 오류:', error);
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        '템플릿을 저장하는 중 오류가 발생했습니다.'
      );
    }
  }
);

// 템플릿 업데이트
export const updateTemplate = createAsyncThunk(
  'templates/updateTemplate',
  async (template: MessageTemplate, { rejectWithValue }) => {
    try {
      console.log('✏️ updateTemplate: API로 템플릿 수정 시작:', template.title);
      
      const response = await api.put('/v2/templates', template);
      
      if (response.data.success) {
        console.log('✅ updateTemplate: 템플릿 수정 성공');
        
        // 성공 시 localStorage에도 백업 업데이트
        try {
          const storedTemplates = localStorage.getItem('messageTemplates');
          if (storedTemplates) {
            const currentTemplates = JSON.parse(storedTemplates);
            const updatedTemplates = currentTemplates.map((t: MessageTemplate) => 
              t.id === template.id ? template : t
            );
            localStorage.setItem('messageTemplates', JSON.stringify(updatedTemplates));
            console.log('💾 updateTemplate: localStorage 백업 업데이트 완료');
          }
        } catch (localError) {
          console.warn('⚠️ updateTemplate: localStorage 백업 업데이트 실패:', localError);
        }
        
        return response.data.data as MessageTemplate;
      } else {
        throw new Error(response.data.message || '템플릿 수정에 실패했습니다.');
      }
      
    } catch (error: any) {
      console.error('❌ updateTemplate: 템플릿 수정 오류:', error);
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        '템플릿을 업데이트하는 중 오류가 발생했습니다.'
      );
    }
  }
);

// 템플릿 삭제
export const deleteTemplate = createAsyncThunk(
  'templates/deleteTemplate',
  async (templateId: string, { rejectWithValue }) => {
    try {
      console.log('🗑️ deleteTemplate: API로 템플릿 삭제 시작:', templateId);
      
      const response = await api.delete(`/v2/templates?id=${templateId}`);
      
      if (response.data.success) {
        console.log('✅ deleteTemplate: 템플릿 삭제 성공');
        
        // 성공 시 localStorage에서도 백업 삭제
        try {
          const storedTemplates = localStorage.getItem('messageTemplates');
          if (storedTemplates) {
            const currentTemplates = JSON.parse(storedTemplates);
            const updatedTemplates = currentTemplates.filter((t: MessageTemplate) => 
              t.id !== templateId
            );
            localStorage.setItem('messageTemplates', JSON.stringify(updatedTemplates));
            console.log('💾 deleteTemplate: localStorage 백업 삭제 완료');
          }
        } catch (localError) {
          console.warn('⚠️ deleteTemplate: localStorage 백업 삭제 실패:', localError);
        }
        
        return templateId;
      } else {
        throw new Error(response.data.message || '템플릿 삭제에 실패했습니다.');
      }
      
    } catch (error: any) {
      console.error('❌ deleteTemplate: 템플릿 삭제 오류:', error);
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        '템플릿을 삭제하는 중 오류가 발생했습니다.'
      );
    }
  }
);

// 초기 상태
const initialState: TemplatesState = {
  templates: [],
  isLoading: false,
  error: null
};

// 슬라이스 생성
const templatesSlice = createSlice({
  name: 'templates',
  initialState,
  reducers: {
    // 에러 상태 초기화
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // fetchTemplates
      .addCase(fetchTemplates.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTemplates.fulfilled, (state, action) => {
        state.templates = action.payload;
        state.isLoading = false;
        state.error = null;
        console.log('📊 fetchTemplates 완료 - 템플릿 수:', action.payload.length);
      })
      .addCase(fetchTemplates.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        console.error('📊 fetchTemplates 실패:', action.payload);
      })
      // addTemplate
      .addCase(addTemplate.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(addTemplate.fulfilled, (state, action) => {
        state.templates.unshift(action.payload);
        state.isLoading = false;
        state.error = null;
        console.log('📊 addTemplate 완료 - 새 템플릿 추가됨:', action.payload.title);
      })
      .addCase(addTemplate.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        console.error('📊 addTemplate 실패:', action.payload);
      })
      // updateTemplate
      .addCase(updateTemplate.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateTemplate.fulfilled, (state, action) => {
        const index = state.templates.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.templates[index] = action.payload;
        }
        state.isLoading = false;
        state.error = null;
        console.log('📊 updateTemplate 완료 - 템플릿 수정됨:', action.payload.title);
      })
      .addCase(updateTemplate.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        console.error('📊 updateTemplate 실패:', action.payload);
      })
      // deleteTemplate
      .addCase(deleteTemplate.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteTemplate.fulfilled, (state, action) => {
        state.templates = state.templates.filter(t => t.id !== action.payload);
        state.isLoading = false;
        state.error = null;
        console.log('📊 deleteTemplate 완료 - 템플릿 삭제됨:', action.payload);
      })
      .addCase(deleteTemplate.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        console.error('📊 deleteTemplate 실패:', action.payload);
      });
  }
});

export const { clearError } = templatesSlice.actions;
export default templatesSlice.reducer;