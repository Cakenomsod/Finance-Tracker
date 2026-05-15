'use client';

import { useAuth as useAuthContext } from '@/components/auth-context';

export const useAuth = () => {
  return useAuthContext();
};
