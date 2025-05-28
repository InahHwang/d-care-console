//src/store/slices/templatesSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '@/store'
import { MessageTemplate } from '@/types/messageLog'

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
      // 실제 API 호출로 대체되어야 함 (현재는 localStorage 사용)
      const storedTemplates = localStorage.getItem('messageTemplates');
      console.log('fetchTemplates: localStorage에서 템플릿 불러오기 시도', storedTemplates);
      
      if (storedTemplates) {
        const parsedTemplates = JSON.parse(storedTemplates) as MessageTemplate[];
        console.log('fetchTemplates: 파싱된 템플릿', parsedTemplates);
        return parsedTemplates;
      }
      
      // 저장된 데이터가 없으면 빈 배열 반환
      console.log('fetchTemplates: localStorage에 템플릿 없음, 빈 배열 반환');
      return [] as MessageTemplate[];
    } catch (error: any) {
      console.error('fetchTemplates: 템플릿 불러오기 오류:', error);
      return rejectWithValue('템플릿을 불러오는 중 오류가 발생했습니다: ' + error.message);
    }
  }
);

// 템플릿 추가
export const addTemplate = createAsyncThunk(
  'templates/addTemplate',
  async (template: MessageTemplate, { getState, rejectWithValue }) => {
    try {
      console.log('템플릿 추가 액션 시작:', template);
      
      // 현재 템플릿 가져오기
      const state = getState() as RootState;
      const currentTemplates = [...state.templates.templates];
      console.log('현재 템플릿 상태:', currentTemplates);
      
      // 새 템플릿 추가
      const updatedTemplates = [template, ...currentTemplates];
      
      // localStorage에 저장 - 이 부분이 실행되는지 확인
      console.log('localStorage에 저장 시도:', updatedTemplates);
      localStorage.setItem('messageTemplates', JSON.stringify(updatedTemplates));
      console.log('localStorage 저장 후:', localStorage.getItem('messageTemplates'));
      
      return template;
    } catch (error: any) {
      console.error('템플릿 저장 오류:', error);
      return rejectWithValue('템플릿을 저장하는 중 오류가 발생했습니다: ' + error.message);
    }
  }
);

// 템플릿 업데이트
export const updateTemplate = createAsyncThunk(
  'templates/updateTemplate',
  async (template: MessageTemplate, { getState, rejectWithValue }) => {
    try {
      // 현재 템플릿 가져오기
      const state = getState() as RootState;
      const currentTemplates = [...state.templates.templates];
      
      // 템플릿 업데이트
      const updatedTemplates = currentTemplates.map(t => 
        t.id === template.id ? template : t
      );
      
      // localStorage에 저장 (실제 API 호출로 대체되어야 함)
      localStorage.setItem('messageTemplates', JSON.stringify(updatedTemplates));
      
      return template;
    } catch (error) {
      return rejectWithValue('템플릿을 업데이트하는 중 오류가 발생했습니다.');
    }
  }
);

// 템플릿 삭제
export const deleteTemplate = createAsyncThunk(
  'templates/deleteTemplate',
  async (templateId: string, { getState, rejectWithValue }) => {
    try {
      // 현재 템플릿 가져오기
      const state = getState() as RootState;
      const currentTemplates = [...state.templates.templates];
      
      // 템플릿 삭제
      const updatedTemplates = currentTemplates.filter(t => t.id !== templateId);
      
      // localStorage에 저장 (실제 API 호출로 대체되어야 함)
      localStorage.setItem('messageTemplates', JSON.stringify(updatedTemplates));
      
      return templateId;
    } catch (error) {
      return rejectWithValue('템플릿을 삭제하는 중 오류가 발생했습니다.');
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
  reducers: {},
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
      })
      .addCase(fetchTemplates.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // addTemplate
      .addCase(addTemplate.fulfilled, (state, action) => {
        state.templates.unshift(action.payload);
      })
      // updateTemplate
      .addCase(updateTemplate.fulfilled, (state, action) => {
        const index = state.templates.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.templates[index] = action.payload;
        }
      })
      // deleteTemplate
      .addCase(deleteTemplate.fulfilled, (state, action) => {
        state.templates = state.templates.filter(t => t.id !== action.payload);
      });
  }
});

export default templatesSlice.reducer;