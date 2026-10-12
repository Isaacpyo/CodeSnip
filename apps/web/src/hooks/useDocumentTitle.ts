import { useEffect } from 'react';

export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title
      ? `${title} · CodeSnip`
      : 'CodeSnip: your code snippets, searchable and shareable';
  }, [title]);
}
