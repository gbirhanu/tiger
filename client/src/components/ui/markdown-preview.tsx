import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { cn } from '@/lib/utils';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
  removeHeadings?: boolean;
}

export function MarkdownPreview({ content, className, removeHeadings = false }: MarkdownPreviewProps) {
  // Process content if needed
  const processedContent = removeHeadings 
    ? content.replace(/^#+\s+.*$/gm, '') // Remove headings
    : content;
    
  return (
    <article className={cn(
      "prose prose-sm md:prose max-w-none dark:prose-invert",
      "prose-headings:font-bold prose-headings:text-primary",
      "prose-h1:text-2xl prose-h1:border-b prose-h1:pb-2 prose-h1:mb-4",
      "prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3",
      "prose-h3:text-lg prose-h3:mt-5 prose-h3:mb-2",
      "prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline",
      "prose-strong:text-primary prose-strong:font-bold",
      "prose-code:text-pink-500 dark:prose-code:text-pink-400 prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded",
      "prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:p-4 prose-pre:rounded-md",
      "prose-blockquote:border-l-4 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-700",
      "prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-700 dark:prose-blockquote:text-gray-300",
      "prose-ul:list-disc prose-ol:list-decimal prose-li:my-1",
      "prose-table:border-collapse prose-table:w-full",
      "prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-700 prose-th:p-2 prose-th:bg-gray-100 dark:prose-th:bg-gray-800",
      "prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-700 prose-td:p-2",
      className
    )}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeRaw, rehypeSanitize]]}
      >
        {processedContent}
      </ReactMarkdown>
    </article>
  );
} 