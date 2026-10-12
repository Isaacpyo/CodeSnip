import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useBackend } from '../backend/context';
import { notify } from '../ui/notify';

/** One-click sign-in to the shared demo account. */
export function useDemoSignIn() {
  const backend = useBackend();
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: () => backend.auth.signInAsDemo(),
    onSuccess: () => navigate('/app'),
    onError: (error) => notify.error(error, 'Couldn’t start the demo'),
  });
  return { signIn: () => mutation.mutate(), pending: mutation.isPending };
}
