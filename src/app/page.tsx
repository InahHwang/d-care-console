// src/app/page.tsx — V2 대시보드로 리다이렉트
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/v2/dashboard');
}
