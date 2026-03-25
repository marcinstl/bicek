'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ApexOptions } from 'apexcharts';
import type { ExerciseKind } from '@/lib/types';
import type { ExerciseHistoryEntry } from '@/lib/api';
import {
  aggregateExerciseHistoryForRange,
  type ExerciseHistoryRange,
  formatExerciseStatValue,
  metricHintForKind,
} from '@/lib/exercise-stats';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface Props {
  history: ExerciseHistoryEntry[] | undefined;
  kind: ExerciseKind;
}

const RANGE_OPTIONS: Array<{ value: ExerciseHistoryRange; label: string }> = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

function barColorForKind(kind: ExerciseKind): string {
  if (kind === 'weighted_reps') return '#f97316'; // orange-500
  if (kind === 'bodyweight_reps') return '#8b5cf6'; // violet-500
  if (kind === 'time_based') return '#0ea5e9'; // sky-500
  if (kind === 'distance_per_time') return '#f43f5e'; // rose-500
  return '#10b981'; // emerald-500 fallback
}

export function ExerciseHistoryBarChart({ history, kind }: Props) {
  const [range, setRange] = useState<ExerciseHistoryRange>('week');
  const [offset, setOffset] = useState(0);

  const viewNow = useMemo(() => {
    const base = new Date();
    if (offset === 0) return base;
    const d = new Date(base);
    if (range === 'year') d.setFullYear(d.getFullYear() + offset);
    else if (range === 'quarter') d.setMonth(d.getMonth() + offset * 3);
    else if (range === 'month') d.setMonth(d.getMonth() + offset);
    else d.setDate(d.getDate() + offset * 7); // week
    return d;
  }, [range, offset]);

  const points = useMemo(
    () => aggregateExerciseHistoryForRange(history, kind, range, viewNow),
    [history, kind, range, viewNow]
  );

  const series = useMemo(
    () => [
      {
        name: metricHintForKind(kind),
        data: points.map((p) => Number(p.value.toFixed(2))),
      },
    ],
    [points, kind]
  );

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'bar',
        toolbar: { show: false },
        parentHeightOffset: 0,
        animations: {
          enabled: false,
        },
      },
      plotOptions: {
        bar: {
          borderRadius: 0,
          columnWidth: '58%',
        },
      },
      dataLabels: { enabled: false },
      grid: {
        borderColor: '#e5e7eb',
        strokeDashArray: 3,
      },
      colors: [barColorForKind(kind)],
      xaxis: {
        categories: points.map((p) => p.label),
        labels: {
          formatter: (value) => {
            const raw = String(value ?? '');
            const nbsp = '\u00A0';
            const parts = raw.split('\n').map((s) => s.trim());
            // Always return exactly 3 lines to keep chart height stable across views.
            const padded = [parts[0] ?? '', parts[1] ?? '', parts[2] ?? ''].map((s) => (s.length ? s : nbsp));
            return padded;
          },
          rotate: 0,
          trim: true,
          hideOverlappingLabels: true,
          style: {
            colors: '#6b7280',
            fontSize: '11px',
          },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: {
          formatter: (value) => formatExerciseStatValue(kind, Number(value)),
          style: {
            colors: '#6b7280',
            fontSize: '11px',
          },
        },
      },
      tooltip: {
        y: {
          formatter: (value) => formatExerciseStatValue(kind, Number(value)),
        },
      },
      legend: { show: false },
    }),
    [points, kind]
  );

  return (
    <section className="mb-6 border-b border-gray-100 pb-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          {metricHintForKind(kind)}
        </p>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOffset((o) => o - 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100"
            aria-label="Previous"
            title="Previous"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setOffset((o) => Math.min(0, o + 1))}
            disabled={offset === 0}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
            aria-label="Next"
            title="Next"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <label className="sr-only" htmlFor="exercise-history-range">
          Chart range
        </label>
        <select
          id="exercise-history-range"
          value={range}
          onChange={(e) => {
            setRange(e.target.value as ExerciseHistoryRange);
            setOffset(0);
          }}
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 outline-none transition-colors hover:border-gray-300 focus:border-emerald-500"
        >
          {RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <ApexChart type="bar" height={280} options={options} series={series} />
    </section>
  );
}
