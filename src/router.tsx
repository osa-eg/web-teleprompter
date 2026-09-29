import { createHashRouter, Navigate } from 'react-router';
import { LoadingScreen } from './app/LoadingScreen';
import { Root } from './app/Root';
import { RouteError } from './app/RouteError';
import { Shell } from './app/Shell';

// Hash routing: GitHub Pages has no SPA fallback, so deep links must live after the `#`.
export const router = createHashRouter([
  {
    Component: Root,
    ErrorBoundary: RouteError,
    HydrateFallback: LoadingScreen,
    children: [
      {
        Component: Shell,
        children: [
          {
            index: true,
            lazy: async () => ({ Component: (await import('./features/library/LibraryPage')).LibraryPage }),
          },
          {
            path: 's/:id/edit',
            lazy: async () => ({ Component: (await import('./features/editor/EditorPage')).EditorPage }),
          },
          {
            path: 'settings/:section?',
            lazy: async () => ({
              Component: (await import('./features/settings/SettingsPage')).SettingsPage,
            }),
          },
        ],
      },
      {
        path: 's/:id/prompt',
        lazy: async () => ({ Component: (await import('./features/prompter/PrompterPage')).PrompterPage }),
      },
      {
        path: 's/:id/display/:sid',
        lazy: async () => ({ Component: (await import('./features/prompter/PrompterPage')).DisplayPage }),
      },
      {
        path: 'remote',
        lazy: async () => ({ Component: (await import('./features/remote/RemotePage')).RemotePage }),
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
