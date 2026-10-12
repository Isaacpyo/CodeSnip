import type { RouteObject } from 'react-router';
import { RequireAuth } from './auth/RequireAuth';
import { AppShell } from './components/AppShell';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { ExplorePage } from './pages/ExplorePage';
import { LandingPage } from './pages/LandingPage';
import { LibraryPage } from './pages/LibraryPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage, RouteErrorPage } from './pages/NotFoundPage';
import { SharedSnippetPage } from './pages/SharedSnippetPage';
import { SnippetEditorPage } from './pages/SnippetEditorPage';

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'auth/callback', element: <AuthCallbackPage /> },
      { path: 'explore', element: <ExplorePage /> },
      { path: 's/:id', element: <SharedSnippetPage /> },
      {
        path: 'app',
        element: <RequireAuth />,
        children: [
          { index: true, element: <LibraryPage /> },
          { path: 'new', element: <SnippetEditorPage /> },
          { path: 'snippets/:id', element: <SnippetEditorPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
