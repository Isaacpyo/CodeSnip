import { Button, IconButton, type ButtonProps } from '@chakra-ui/react';
import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { copyText } from '../lib/clipboard';
import { notify } from '../ui/notify';

interface CopyButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  /** Text to copy, or a function returning it (sync or async) when clicked. */
  text: string | (() => string | Promise<string>);
  label?: string;
  copiedLabel?: string;
  iconOnly?: boolean;
  successMessage?: string;
}

export function CopyButton({
  text,
  label = 'Copy',
  copiedLabel = 'Copied',
  iconOnly = false,
  successMessage = 'Copied to clipboard',
  ...buttonProps
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const onClick = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await copyText(typeof text === 'function' ? text() : text);
      setCopied(true);
      notify.success(successMessage);
    } catch (error) {
      notify.error(error, 'Couldn’t copy to the clipboard');
    }
  };

  const icon = copied ? <Check /> : <Copy />;
  if (iconOnly) {
    return (
      <IconButton
        aria-label={copied ? copiedLabel : label}
        title={label}
        onClick={onClick}
        {...buttonProps}
      >
        {icon}
      </IconButton>
    );
  }
  return (
    <Button onClick={onClick} {...buttonProps}>
      {icon} {copied ? copiedLabel : label}
    </Button>
  );
}
