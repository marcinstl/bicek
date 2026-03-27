'use client';

import { use } from 'react';
import { useSearchParams, redirect } from 'next/navigation';

interface Props {
  params: Promise<{ planId: string }>;
}

export default function WorkoutSummaryRedirect({ params }: Props) {
  use(params);
  const searchParams = useSearchParams();
  const workoutId = searchParams.get('workoutId');
  if (workoutId) {
    redirect(`/history/${workoutId}`);
  }
  redirect('/history');
}
