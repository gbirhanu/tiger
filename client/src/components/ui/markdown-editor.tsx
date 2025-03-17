import React from 'react';
import MDEditor from '@uiw/react-md-editor';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: number;
}

export function MarkdownEditor({ value, onChange, height = 300 }: MarkdownEditorProps) {
  return (
    <MDEditor
      value={value}
      onChange={(val) => onChange(val || '')}
      preview="edit"
      height={height}
      previewOptions={{
        rehypePlugins: [[rehypeRaw, rehypeSanitize]]
      }}
    />
  );
} 