// src/store/slices/campaignsSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { EventTargetReason } from './patientsSlice';
import { EventCategory } from '@/types/messageLog'


// 캠페인 타입 정의
export type CampaignStatus = 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface CampaignTarget {
  category?: EventCategory[];
  reason?: EventTargetReason[];
  customFilter?: string;
}

export interface CampaignMessage {
  title: string;
  content: string;
  templateName?: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  createdAt: string;
  scheduledAt?: string;
  completedAt?: string;
  targetCount: number;
  targetCriteria: CampaignTarget;
  message: CampaignMessage;
  notes?: string;
  creator?: string;
}

interface CampaignsState {
  campaigns: Campaign[];
  currentCampaign: Campaign | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: CampaignsState = {
  campaigns: [],
  currentCampaign: null,
  isLoading: false,
  error: null
};

// 캠페인 목록 조회
export const fetchCampaigns = createAsyncThunk(
  'campaigns/fetchCampaigns',
  async (_, { rejectWithValue }) => {
    try {
      // API 호출 (실제 구현 시 API 엔드포인트로 변경)
      // const response = await api.get('/campaigns');
      // return response.data;
      
      // 목업 데이터
      return [
        {
          id: 'camp-1',
          name: '여름 할인 캠페인',
          status: 'scheduled',
          createdAt: '2025-04-25T09:00:00Z',
          scheduledAt: '2025-05-15T09:00:00Z',
          targetCount: 12,
          targetCriteria: {
            category: ['discount', 'seasonal'],
            reason: ['price_hesitation']
          },
          message: {
            title: '5월 특별 할인 안내',
            content: '안녕하세요, {{name}}님. 5월 가정의 달을 맞아 임플란트 시술을 20% 할인된 가격에 제공해드립니다. 자세한 내용은 첨부된 링크를 확인해주세요.',
            templateName: '할인 안내'
          },
          creator: '김상담'
        },
        {
          id: 'camp-2',
          name: '정기 검진 리마인더',
          status: 'completed',
          createdAt: '2025-03-10T10:30:00Z',
          scheduledAt: '2025-03-20T09:00:00Z',
          completedAt: '2025-03-20T09:15:00Z',
          targetCount: 25,
          targetCriteria: {
            category: ['checkup']
          },
          message: {
            title: '정기 검진 안내',
            content: '{{name}}님, 정기 검진 일정을 안내해 드립니다. 구강 건강을 위해 정기적인 검진이 중요합니다.',
            templateName: '정기 검진'
          },
          creator: '이담당'
        }
      ] as Campaign[];
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '캠페인 조회 실패');
    }
  }
);

// 캠페인 생성
  export const createCampaign = createAsyncThunk(
    'campaigns/createCampaign',
    async (campaignData: Omit<Campaign, 'id' | 'createdAt'>, { rejectWithValue }) => {
      try {
        // API 호출 (실제 구현 시 API 엔드포인트로 변경)
        // const response = await api.post('/campaigns', campaignData);
        // return response.data;
        
        // 목업 응답
        const id = `camp-${Math.floor(Math.random() * 1000)}`;
        const createdAt = new Date().toISOString();
        
        return {
          id,
          createdAt,
          ...campaignData
        } as Campaign;
      } catch (error) {
        return rejectWithValue(error instanceof Error ? error.message : '캠페인 생성 실패');
      }
    }
  );

// 캠페인 상태 변경
export const updateCampaignStatus = createAsyncThunk(
  'campaigns/updateCampaignStatus',
  async ({ campaignId, status }: { campaignId: string; status: CampaignStatus }, { rejectWithValue }) => {
    try {
      // API 호출 (실제 구현 시 API 엔드포인트로 변경)
      // const response = await api.patch(`/campaigns/${campaignId}/status`, { status });
      // return response.data;
      
      // 목업 응답
      return {
        campaignId,
        status,
        updatedAt: new Date().toISOString(),
        completedAt: status === 'completed' ? new Date().toISOString() : undefined
      };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '캠페인 상태 변경 실패');
    }
  }
);


// 캠페인 슬라이스
const campaignsSlice = createSlice({
  name: 'campaigns',
  initialState,
  reducers: {
    selectCampaign: (state, action: PayloadAction<string>) => {
      state.currentCampaign = state.campaigns.find(campaign => campaign.id === action.payload) || null;
    },
    clearCurrentCampaign: (state) => {
      state.currentCampaign = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // 캠페인 목록 조회
      .addCase(fetchCampaigns.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCampaigns.fulfilled, (state, action) => {
        state.isLoading = false;
        state.campaigns = action.payload;
      })
      .addCase(fetchCampaigns.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // 캠페인 생성
      .addCase(createCampaign.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createCampaign.fulfilled, (state, action) => {
        state.isLoading = false;
        state.campaigns.push(action.payload);
        state.currentCampaign = action.payload;
      })
      .addCase(createCampaign.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // 캠페인 상태 변경
      .addCase(updateCampaignStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateCampaignStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        const { campaignId, status, completedAt } = action.payload;
        
        // 캠페인 목록에서 해당 캠페인 찾아서 상태 업데이트
        const campaign = state.campaigns.find(c => c.id === campaignId);
        if (campaign) {
          campaign.status = status;
          if (completedAt) campaign.completedAt = completedAt;
        }
        
        // 현재 선택된 캠페인이 있고, 그 캠페인이 업데이트된 캠페인이면 currentCampaign도 업데이트
        if (state.currentCampaign && state.currentCampaign.id === campaignId) {
          state.currentCampaign.status = status;
          if (completedAt) state.currentCampaign.completedAt = completedAt;
        }
      })
      .addCase(updateCampaignStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { selectCampaign, clearCurrentCampaign } = campaignsSlice.actions;
export default campaignsSlice.reducer;