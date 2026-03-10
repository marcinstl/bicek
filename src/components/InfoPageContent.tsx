'use client';

import { useState } from 'react';
import {
  xpMultiplierBreakdownFromConsistency,
  xpMultiplierFromRateAndConsistency,
  baseExpPerRep,
  totalXpForLevel,
  levelFromTotalXp,
} from '@/lib/xp';
import { adjustDailyRate, adjustConsistency } from '@/lib/progression';

const MIN_RATE = 0.002;
const MAX_RATE = 0.015;

function clampRate(v: number) {
  return Math.max(MIN_RATE, Math.min(MAX_RATE, Number(v)));
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-panel border border-edge rounded-2xl p-4 space-y-3">
      <h2 className="text-sm font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-field border border-edge px-1.5 py-0.5 rounded text-ink font-mono text-xs">
      {children}
    </code>
  );
}

export default function InfoPageContent() {
  return (
    <div className="space-y-6">
      <IntroSection />
      <DailyRateSection />
      <ConsistencyCalculatorSection />
      <MultiplierSection />
      <MaxDailyXpSection />
      <LevelFromXpSection />
      <XpTableSection />
    </div>
  );
}

function IntroSection() {
  return (
    <Section title="Jak działa XP">
      <p className="text-sm text-ink-soft">
        Im więcej i regularniej ćwiczysz, tym więcej XP zdobywasz. Aplikacja nagradza zarówno realizowanie celu (100% targetu), jak i konsekwentne treningi z ostatnich dni — dzięki temu multiplier rośnie stopniowo i nie spada po jednym gorszym dniu. Poniżej znajdziesz dokładne wzory i kalkulatory: jak się liczy daily rate, multiplier oraz max XP na dziś.
      </p>
    </Section>
  );
}

function DailyRateSection() {
  const [dailyRate, setDailyRate] = useState(0.01);
  const [completed, setCompleted] = useState(20);
  const [target, setTarget] = useState(20);

  const nextRate = adjustDailyRate(dailyRate, completed, target);
  const ratio = target > 0 ? (completed / target) : 0;

  return (
    <Section title="Jak się oblicza dailyRate">
      <p className="text-sm text-ink-soft">
        Nowe ćwiczenie startuje z <Code>dailyRate = 0,01</Code>. Po każdej sesji
        rate jest aktualizowany w zależności od stosunku <Code>completed / target</Code>:
      </p>
      <ul className="text-sm text-ink-soft list-disc list-inside space-y-1">
        <li><Code>completed / target ≥ 1,0</Code> → +0,001 (max 0,015)</li>
        <li><Code>≥ 0,85</Code> → bez zmiany</li>
        <li><Code>≥ 0,60</Code> → −0,002 (min 0,002)</li>
        <li><Code>&lt; 0,60</Code> → −0,005 (min 0,002)</li>
      </ul>
      <div className="pt-2 space-y-3 border-t border-edge">
        <p className="text-xs text-ink-faint font-medium">Symulacja po sesji</p>
        <div>
          <label className="text-xs text-ink-faint block mb-1">
            dailyRate ({MIN_RATE}–{MAX_RATE})
          </label>
          <input
            type="range"
            min={MIN_RATE}
            max={MAX_RATE}
            step={0.001}
            value={dailyRate}
            onChange={(e) => setDailyRate(clampRate(Number(e.target.value)))}
            className="w-full h-2 rounded-full bg-field accent-emerald-500"
          />
          <span className="text-xs text-ink-soft tabular-nums">{dailyRate.toFixed(3)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-ink-soft">
            completed
            <input
              type="number"
              min={0}
              max={999}
              value={completed}
              onChange={(e) => setCompleted(Math.max(0, Math.min(999, Number(e.target.value) || 0)))}
              className="mt-1 w-full rounded-lg bg-field border border-edge px-2 py-1.5 text-ink text-sm"
            />
          </label>
          <label className="text-xs text-ink-soft">
            target
            <input
              type="number"
              min={1}
              max={999}
              value={target}
              onChange={(e) => setTarget(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
              className="mt-1 w-full rounded-lg bg-field border border-edge px-2 py-1.5 text-ink text-sm"
            />
          </label>
        </div>
        <p className="text-sm text-ink-soft">
          Ratio = {ratio.toFixed(2)} → nowy dailyRate = <strong className="text-ink">{nextRate.toFixed(4)} ({(nextRate * 100).toFixed(2)}%)</strong>
        </p>
      </div>
    </Section>
  );
}

function ConsistencyCalculatorSection() {
  const [consistency, setConsistency] = useState(0.3);
  const [completed, setCompleted] = useState(20);
  const [target, setTarget] = useState(20);

  const ratio = target > 0 ? completed / target : 0;
  const newConsistency = adjustConsistency(consistency, completed, target);
  const delta = newConsistency - consistency;
  const outcome = ratio >= 0.85 ? 'dobrze (+0,05)' : ratio >= 0.6 ? 'średnio (0)' : 'słabo (−0,05)';

  return (
    <Section title="Kalkulator konsystencji">
      <p className="text-sm text-ink-soft">
        Konsystencja (0–1) jest zapisywana jak dailyRate: po każdej sesji <strong>dobrze</strong> (ratio ≥ 0,85) → +0,05 (max 1), <strong>średnio</strong> (0,6–0,85) → bez zmiany, <strong>słabo</strong> (&lt;0,6) → −0,05 (min 0). Nowe ćwiczenie startuje z 0.
      </p>
      <div className="pt-2 space-y-3 border-t border-edge">
        <div>
          <label className="text-xs text-ink-faint block mb-1">obecna konsystencja (0–1)</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={consistency}
            onChange={(e) => setConsistency(Math.max(0, Math.min(1, Number(e.target.value))))}
            className="w-full h-2 rounded-full bg-field accent-emerald-500"
          />
          <span className="text-xs text-ink-soft tabular-nums">{consistency.toFixed(2)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-ink-soft">
            completed
            <input
              type="number"
              min={0}
              max={999}
              value={completed}
              onChange={(e) => setCompleted(Math.max(0, Math.min(999, Number(e.target.value) || 0)))}
              className="mt-1 w-full rounded-lg bg-field border border-edge px-2 py-1.5 text-ink text-sm"
            />
          </label>
          <label className="text-xs text-ink-soft">
            target
            <input
              type="number"
              min={1}
              max={999}
              value={target}
              onChange={(e) => setTarget(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
              className="mt-1 w-full rounded-lg bg-field border border-edge px-2 py-1.5 text-ink text-sm"
            />
          </label>
        </div>
        <p className="text-sm text-ink-soft">
          Ratio = {ratio.toFixed(2)} → {outcome}<br />
          → <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">{newConsistency.toFixed(2)}</strong>
        </p>
      </div>
    </Section>
  );
}

function MultiplierSection() {
  const [dailyRate, setDailyRate] = useState(0.01);
  const [consistency, setConsistency] = useState(0.5);

  const { mult, rateNorm, consistencyNorm } = xpMultiplierBreakdownFromConsistency(dailyRate, consistency);

  return (
    <Section title="Wzór na multiplier">
      <p className="text-sm text-ink-soft">
        Multiplier z <Code>dailyRate</Code> i <Code>konsystencji</Code> (0–1) — zapisywanej po każdej sesji: dobrze +0,05, średnio 0, słabo −0,05.
        <br />
        <Code>mult = clamp(1, 5, 1 + 4×consistency×(0,5+0,5×rateNorm))</Code>. Przy consistency=0 mult=1×.
      </p>
      <div className="space-y-3 pt-2 border-t border-edge">
        <div>
          <label className="text-xs text-ink-faint block mb-1">
            dailyRate ({MIN_RATE}–{MAX_RATE})
          </label>
          <input
            type="range"
            min={MIN_RATE}
            max={MAX_RATE}
            step={0.001}
            value={dailyRate}
            onChange={(e) => setDailyRate(clampRate(Number(e.target.value)))}
            className="w-full h-2 rounded-full bg-field accent-emerald-500"
          />
          <div className="flex items-center justify-between text-xs text-ink-soft">
            <span className="tabular-nums">{dailyRate.toFixed(3)}</span>
            <span className="tabular-nums" title="dailyRate znormalizowany do 0–1: (dailyRate − 0,002) / 0,013">
              rateNorm ≈ {rateNorm.toFixed(3)}
            </span>
          </div>
        </div>
        <div>
          <label className="text-xs text-ink-faint block mb-1">konsystencja (0–1)</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={consistency}
            onChange={(e) => setConsistency(Math.max(0, Math.min(1, Number(e.target.value))))}
            className="w-full h-2 rounded-full bg-field accent-emerald-500"
          />
          <span className="text-xs text-ink-soft tabular-nums">{consistency.toFixed(2)}</span>
        </div>
        <p className="text-sm text-ink-soft">
          → <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">{mult.toFixed(2)}×</strong>
        </p>
      </div>
    </Section>
  );
}

function MaxDailyXpSection() {
  const [level, setLevel] = useState(12);
  const [target, setTarget] = useState(20);
  const [dailyRate, setDailyRate] = useState(0.01);
  const [consistency, setConsistency] = useState(0.5);

  const basePerRep = baseExpPerRep(level);
  const mult = xpMultiplierFromRateAndConsistency(dailyRate, consistency);
  const maxDailyXp = Math.floor(target * basePerRep * mult);

  return (
    <Section title="Max exp na dziś">
      <p className="text-sm text-ink-soft">
        <Code>maxDailyXp = floor(target × baseExpPerRep(level) × multiplier)</Code>, gdzie baseExpPerRep = 1 + floor(level/10).
      </p>
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-edge">
        <label className="text-xs text-ink-soft">
          level (1–100)
          <input
            type="number"
            min={1}
            max={100}
            value={level}
            onChange={(e) => setLevel(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
            className="mt-1 w-full rounded-lg bg-field border border-edge px-2 py-1.5 text-ink text-sm"
          />
        </label>
        <label className="text-xs text-ink-soft">
          target (1–999)
          <input
            type="number"
            min={1}
            max={999}
            value={target}
            onChange={(e) => setTarget(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
            className="mt-1 w-full rounded-lg bg-field border border-edge px-2 py-1.5 text-ink text-sm"
          />
        </label>
        <label className="text-xs text-ink-soft col-span-2">
          dailyRate
          <input
            type="range"
            min={MIN_RATE}
            max={MAX_RATE}
            step={0.001}
            value={dailyRate}
            onChange={(e) => setDailyRate(clampRate(Number(e.target.value)))}
            className="mt-1 w-full h-2 rounded-full bg-field accent-emerald-500"
          />
          <span className="tabular-nums text-sm">{dailyRate.toFixed(3)}</span>
        </label>
        <div className="col-span-2">
          <label className="text-xs text-ink-faint block mb-1">konsystencja (0–1)</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={consistency}
            onChange={(e) => setConsistency(Math.max(0, Math.min(1, Number(e.target.value))))}
            className="w-full h-2 rounded-full bg-field accent-emerald-500"
          />
          <span className="text-xs text-ink-soft tabular-nums">{consistency.toFixed(2)}</span>
        </div>
      </div>
      <p className="text-sm text-ink-soft">
        baseExpPerRep({level}) = {basePerRep}<br />
        mult = {mult.toFixed(2)}×<br />
        → <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">{maxDailyXp} XP</strong>
      </p>
    </Section>
  );
}

function LevelFromXpSection() {
  const [totalXp, setTotalXp] = useState(600);

  const clamped = Math.max(0, totalXp);
  const level = levelFromTotalXp(clamped);
  const nextStart = totalXpForLevel(level + 1);
  const currentStart = totalXpForLevel(level);
  const xpRemaining = nextStart - clamped;

  return (
    <Section title="Level i XP do następnego poziomu">
      <p className="text-sm text-ink-soft">
        <Code>totalXpForLevel(L) = 0</Code> dla L≤1, inaczej <Code>50×L²</Code>.
        Level: totalXp &lt; 200 → 1, inaczej <Code>floor(√(totalXp/50))</Code>.
      </p>
      <div className="pt-2 border-t border-edge">
        <label className="text-xs text-ink-faint block mb-1">totalXp (0–500 000)</label>
        <input
          type="number"
          min={0}
          max={500000}
          value={totalXp}
          onChange={(e) => setTotalXp(Math.max(0, Math.min(500000, Number(e.target.value) || 0)))}
          className="w-full rounded-lg bg-field border border-edge px-3 py-2 text-ink text-sm"
        />
        <p className="mt-2 text-sm text-ink-soft">
          Level = {level}<br />
          → <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">{xpRemaining} XP do L{level + 1}</strong>
        </p>
      </div>
    </Section>
  );
}

const XP_TABLE_LEVELS = Array.from({ length: 30 }, (_, i) => i + 1).map((L) => ({
  level: L,
  total: L <= 1 ? 0 : 50 * L * L,
  toNext: L === 1 ? 200 : 50 * (2 * L + 1),
}));

function XpTableSection() {
  return (
    <Section title="Tabela XP (poziomy 1–30)">
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm border-collapse min-w-[280px]">
          <thead>
            <tr>
              <th className="text-left text-ink font-semibold border-b border-edge py-2 pr-2">Lvl</th>
              <th className="text-right text-ink font-semibold border-b border-edge py-2 pr-2 tabular-nums">Łączna XP</th>
              <th className="text-right text-ink font-semibold border-b border-edge py-2 pr-2 tabular-nums">Do next</th>
            </tr>
          </thead>
          <tbody className="text-ink-soft">
            {XP_TABLE_LEVELS.map(({ level, total, toNext }) => (
              <tr key={level}>
                <td className="border-b border-edge py-1.5 pr-2 font-medium text-ink">{level}</td>
                <td className="border-b border-edge py-1.5 pr-2 text-right tabular-nums">{total.toLocaleString('pl-PL')}</td>
                <td className="border-b border-edge py-1.5 pr-2 text-right tabular-nums">{toNext.toLocaleString('pl-PL')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-faint">
        totalXpForLevel(L) = 50×L² (L≥2); XP do następnego = 50×(2L+1), dla L=1 → 200.
      </p>
    </Section>
  );
}
