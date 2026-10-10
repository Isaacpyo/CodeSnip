import { Box, Input, Tag, Text, Wrap } from '@chakra-ui/react';
import { useId, useState } from 'react';
import { MAX_TAGS, normalizeTag, parseTagInput, tagError } from '../lib/tags';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  id?: string;
  invalid?: boolean;
}

/** Chips + text box. Enter, comma or space adds; Backspace on empty input removes the last tag. */
export function TagInput({ value, onChange, id, invalid }: TagInputProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const hintId = useId();

  const commit = (text: string) => {
    const incoming = parseTagInput(text);
    if (incoming.length === 0) return;
    const problem = incoming.map(tagError).find(Boolean);
    if (problem) {
      setError(problem);
      return;
    }
    const next = [...value];
    for (const tag of incoming) if (!next.includes(tag)) next.push(tag);
    if (next.length > MAX_TAGS) {
      setError(`Use at most ${MAX_TAGS} tags.`);
      return;
    }
    setError(null);
    onChange(next);
    setDraft('');
  };

  return (
    <Box>
      <Wrap
        gap="1.5"
        borderWidth="1px"
        borderColor={invalid || error ? 'border.error' : 'border'}
        borderRadius="l2"
        px="2"
        py="1.5"
        alignItems="center"
        _focusWithin={{
          outline: '2px solid',
          outlineColor: 'teal.focusRing',
          outlineOffset: '-1px',
        }}
      >
        {value.map((tag) => (
          <Tag.Root key={tag} size="md" variant="subtle" colorPalette="teal">
            <Tag.Label>#{tag}</Tag.Label>
            <Tag.EndElement>
              <Tag.CloseTrigger
                aria-label={`Remove tag ${tag}`}
                onClick={() => onChange(value.filter((t) => t !== tag))}
              />
            </Tag.EndElement>
          </Tag.Root>
        ))}
        <Input
          id={id}
          variant="flushed"
          border="none"
          size="sm"
          flex="1"
          minWidth="8rem"
          px="1"
          _focusVisible={{ outline: 'none', boxShadow: 'none' }}
          value={draft}
          placeholder={value.length ? 'Add another…' : 'e.g. react, hooks'}
          aria-describedby={hintId}
          aria-invalid={Boolean(error) || undefined}
          onChange={(e) => {
            const text = e.target.value;
            if (/[,\s]$/.test(text)) commit(text);
            else {
              setDraft(text);
              setError(tagError(normalizeTag(text)));
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(draft);
            } else if (e.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => draft && commit(draft)}
        />
      </Wrap>
      <Text
        id={hintId}
        fontSize="xs"
        mt="1"
        color={error ? 'fg.error' : 'fg.muted'}
        aria-live="polite"
      >
        {error ?? `Press Enter or comma to add. ${value.length}/${MAX_TAGS} tags.`}
      </Text>
    </Box>
  );
}
