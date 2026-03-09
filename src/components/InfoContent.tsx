'use client';

export default function InfoContent({ content }: { content: string }) {
  return (
    <article
      className="info-content max-w-none text-sm text-ink-soft
        [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-ink [&_h1]:mt-6 [&_h1]:mb-2 [&_h1]:first:mt-0
        [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_h2]:mt-4 [&_h2]:mb-2
        [&_p]:mb-3
        [&_ul]:list-disc [&_ul]:list-inside [&_ul]:mb-3 [&_ul]:space-y-1
        [&_li]:text-ink-soft
        [&_code]:bg-field [&_code]:border [&_code]:border-edge [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-ink [&_code]:font-mono [&_code]:text-sm
        [&_table]:w-full [&_table]:text-sm [&_table]:border-collapse [&_table]:my-3
        [&_th]:text-left [&_th]:text-ink [&_th]:font-semibold [&_th]:border-b [&_th]:border-edge [&_th]:py-2 [&_th]:pr-2
        [&_td]:border-b [&_td]:border-edge [&_td]:py-2 [&_td]:pr-2
        [&_strong]:text-ink [&_strong]:font-semibold"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
