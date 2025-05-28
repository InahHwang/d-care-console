//src/store/slices/categoriesSlice.ts 
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '@/store'
import { MessageCategory } from '@/types/messageLog'

interface CategoriesState {
  categories: MessageCategory[];
  isLoading: boolean;
  error: string | null;
}

// 기본 카테고리 정의
const DEFAULT_CATEGORIES: MessageCategory[] = [
  {
    id: 'discount',
    name: 'discount',
    displayName: '할인/프로모션',
    color: 'bg-red-100 text-red-800',
    isDefault: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'new_treatment',
    name: 'new_treatment', 
    displayName: '신규 치료',
    color: 'bg-blue-100 text-blue-800',
    isDefault: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'checkup',
    name: 'checkup',
    displayName: '정기 검진',
    color: 'bg-green-100 text-green-800',
    isDefault: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'seasonal',
    name: 'seasonal',
    displayName: '계절 이벤트',
    color: 'bg-purple-100 text-purple-800',
    isDefault: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

// 카테고리 목록 가져오기
export const fetchCategories = createAsyncThunk(
  'categories/fetchCategories',
  async (_, { rejectWithValue }) => {
    try {
      const storedCategories = localStorage.getItem('messageCategories');
      
      if (storedCategories) {
        const parsedCategories = JSON.parse(storedCategories) as MessageCategory[];
        return parsedCategories;
      }
      
      // 처음 실행 시 기본 카테고리 저장
      localStorage.setItem('messageCategories', JSON.stringify(DEFAULT_CATEGORIES));
      return DEFAULT_CATEGORIES;
    } catch (error: any) {
      return rejectWithValue('카테고리를 불러오는 중 오류가 발생했습니다: ' + error.message);
    }
  }
);

// 카테고리 추가
export const addCategory = createAsyncThunk(
  'categories/addCategory',
  async (category: Omit<MessageCategory, 'id' | 'createdAt' | 'updatedAt'>, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const currentCategories = [...state.categories.categories];
      
      const newCategory: MessageCategory = {
        ...category,
        id: `category_${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      const updatedCategories = [...currentCategories, newCategory];
      localStorage.setItem('messageCategories', JSON.stringify(updatedCategories));
      
      return newCategory;
    } catch (error: any) {
      return rejectWithValue('카테고리를 추가하는 중 오류가 발생했습니다: ' + error.message);
    }
  }
);

// 카테고리 업데이트
export const updateCategory = createAsyncThunk(
  'categories/updateCategory',
  async (category: MessageCategory, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const currentCategories = [...state.categories.categories];
      
      const updatedCategories = currentCategories.map(c => 
        c.id === category.id ? { ...category, updatedAt: new Date().toISOString() } : c
      );
      
      localStorage.setItem('messageCategories', JSON.stringify(updatedCategories));
      return { ...category, updatedAt: new Date().toISOString() };
    } catch (error) {
      return rejectWithValue('카테고리를 업데이트하는 중 오류가 발생했습니다.');
    }
  }
);

// 카테고리 삭제 (기본 카테고리는 삭제 불가)
export const deleteCategory = createAsyncThunk(
  'categories/deleteCategory',
  async (categoryId: string, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const currentCategories = [...state.categories.categories];
      
      // 기본 카테고리 삭제 방지
      const categoryToDelete = currentCategories.find(c => c.id === categoryId);
      if (categoryToDelete?.isDefault) {
        return rejectWithValue('기본 카테고리는 삭제할 수 없습니다.');
      }
      
      const updatedCategories = currentCategories.filter(c => c.id !== categoryId);
      localStorage.setItem('messageCategories', JSON.stringify(updatedCategories));
      
      return categoryId;
    } catch (error) {
      return rejectWithValue('카테고리를 삭제하는 중 오류가 발생했습니다.');
    }
  }
);

const initialState: CategoriesState = {
  categories: [],
  isLoading: false,
  error: null
};

const categoriesSlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategories.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.categories = action.payload;
        state.isLoading = false;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(addCategory.fulfilled, (state, action) => {
        state.categories.push(action.payload);
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        const index = state.categories.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.categories[index] = action.payload;
        }
      })
      .addCase(deleteCategory.fulfilled, (state, action) => {
        state.categories = state.categories.filter(c => c.id !== action.payload);
      });
  }
});

export default categoriesSlice.reducer;
