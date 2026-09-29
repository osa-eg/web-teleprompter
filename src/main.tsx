import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import '@fontsource-variable/cairo/wght.css';
import './styles/tokens.css';
import './styles/base.css';
import { router } from './router';
import { useLibrary } from './stores/library';
import { initSettingsSync } from './stores/settings';

initSettingsSync();
void useLibrary.getState().init();

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
