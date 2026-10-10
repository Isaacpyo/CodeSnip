import { CloseButton, Input, InputGroup, Kbd } from '@chakra-ui/react';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

/** Debounced search input; "/" focuses it from anywhere on the page. */
export function SearchBar({
  value,
  onChange,
  placeholder = 'Search snippets…',
  label = 'Search snippets',
}: SearchBarProps) {
  const [text, setText] = useState(value);
  const debounced = useDebouncedValue(text, 250);
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const lastSent = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Push typed text upstream once the user pauses.
  useEffect(() => {
    if (debounced !== lastSent.current) {
      lastSent.current = debounced;
      onChangeRef.current(debounced);
    }
  }, [debounced]);

  // Follow external changes (e.g. "Clear filters", back/forward navigation).
  useEffect(() => {
    if (value !== lastSent.current) {
      lastSent.current = value;
      setText(value);
    }
  }, [value]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest('input, textarea, [contenteditable="true"], .monaco-editor');
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <InputGroup
      startElement={<Search size={16} aria-hidden />}
      endElement={
        text ? (
          <CloseButton
            size="xs"
            aria-label="Clear search"
            onClick={() => {
              setText('');
              lastSent.current = '';
              onChange('');
              inputRef.current?.focus();
            }}
          />
        ) : (
          <Kbd size="sm" hideBelow="md" aria-hidden>
            /
          </Kbd>
        )
      }
    >
      <Input
        ref={inputRef}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && text) {
            setText('');
          }
        }}
      />
    </InputGroup>
  );
}
