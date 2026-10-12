import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { system } from '../ui/system';
import { TagInput } from './TagInput';

function Harness({ initial = [] as string[] }) {
  const [tags, setTags] = useState(initial);
  return (
    <ChakraProvider value={system}>
      <label htmlFor="tags">Tags</label>
      <TagInput id="tags" value={tags} onChange={setTags} />
      <output data-testid="value">{tags.join('|')}</output>
    </ChakraProvider>
  );
}

describe('TagInput', () => {
  it('adds tags on Enter and comma, normalised and de-duplicated', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Tags');
    await user.type(input, 'React{Enter}hooks,react,');
    expect(screen.getByTestId('value')).toHaveTextContent('react|hooks');
  });

  it('removes the last tag with Backspace and a specific tag with its button', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['a', 'b', 'c']} />);
    await user.click(screen.getByLabelText('Tags'));
    await user.keyboard('{Backspace}');
    expect(screen.getByTestId('value')).toHaveTextContent('a|b');
    await user.click(screen.getByRole('button', { name: 'Remove tag a' }));
    expect(screen.getByTestId('value')).toHaveTextContent('b');
  });

  it('explains invalid tags instead of adding them', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText('Tags'), '!nope{Enter}');
    expect(screen.getByTestId('value')).toHaveTextContent('');
    expect(screen.getByText(/start with a letter or number/)).toBeInTheDocument();
  });
});
