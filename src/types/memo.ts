// src/types/memo.ts

export interface Memo {
  _id: string;
  id: string;
  title: string;
  content: string;
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  color: string;
  isMinimized: boolean;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface CreateMemoRequest {
  title?: string;
  content?: string;
  position?: {
    x: number;
    y: number;
  };
  color?: string;
}

export interface UpdateMemoRequest {
  title?: string;
  content?: string;
  position?: {
    x: number;
    y: number;
  };
  size?: {
    width: number;
    height: number;
  };
  color?: string;
  isMinimized?: boolean;
  zIndex?: number;
}

export interface MemosState {
  memos: Memo[];
  isLoading: boolean;
  error: string | null;
  isManagerVisible: boolean;
  maxZIndex: number;
}