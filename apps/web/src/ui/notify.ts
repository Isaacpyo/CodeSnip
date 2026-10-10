import { friendlyMessage } from '../backend/errors';
import { toaster } from './toaster';

export const notify = {
  success(title: string, description?: string) {
    toaster.create({ type: 'success', title, description, closable: true });
  },
  error(error: unknown, title = 'Something went wrong') {
    toaster.create({
      type: 'error',
      title,
      description: friendlyMessage(error),
      closable: true,
      duration: 8000,
    });
  },
  warning(title: string, description?: string) {
    toaster.create({ type: 'warning', title, description, closable: true });
  },
  info(title: string, description?: string) {
    toaster.create({ type: 'info', title, description, closable: true });
  },
};
