import { Box } from '@chakra-ui/react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import { useColorMode } from '../ui/colorMode';
import { monaco } from './monacoSetup';

export interface CodeEditorProps {
  value: string;
  language: string;
  onChange?: (value: string) => void;
  onSave?: () => void;
  readOnly?: boolean;
  /** CSS height; read-only editors size themselves to their content when omitted. */
  height?: string;
  ariaLabel: string;
}

const LINE_HEIGHT = 20;

export default function CodeEditor({
  value,
  language,
  onChange,
  onSave,
  readOnly = false,
  height,
  ariaLabel,
}: CodeEditorProps) {
  const { colorMode } = useColorMode();
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const handleMount: OnMount = (editor) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSaveRef.current?.());
  };

  const lines = value.split('\n').length;
  const autoHeight = `${Math.min(Math.max(lines * LINE_HEIGHT + 32, 140), 640)}px`;

  return (
    <Box
      borderWidth="1px"
      borderRadius="md"
      overflow="hidden"
      height={height ?? autoHeight}
      data-testid="code-editor"
      _focusWithin={{
        outline: '2px solid',
        outlineColor: 'colorPalette.focusRing',
        outlineOffset: '1px',
      }}
      colorPalette="teal"
    >
      <Editor
        value={value}
        language={language}
        theme={colorMode === 'dark' ? 'vs-dark' : 'light'}
        onChange={(next) => onChange?.(next ?? '')}
        onMount={handleMount}
        loading={null}
        options={{
          ariaLabel,
          readOnly,
          domReadOnly: readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          lineHeight: LINE_HEIGHT,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          tabSize: 2,
          automaticLayout: true,
          padding: { top: 12, bottom: 12 },
          lineNumbersMinChars: 3,
          renderLineHighlight: readOnly ? 'none' : 'line',
          fixedOverflowWidgets: true,
          scrollbar: { alwaysConsumeMouseWheel: false },
        }}
      />
    </Box>
  );
}
