import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import '@fontsource-variable/cairo/wght.css';
import './styles/tokens.css';
import './styles/base.css';
import { initPwa } from './app/pwa';
import { initRemoteHostService } from './features/remote/hostService';
import { router } from './router';
import { useLibrary } from './stores/library';
import { initSettingsSync } from './stores/settings';

// Display windows and phones never host the phone remote; phones need no script library.
const route = window.location.hash;
const isPhoneRemote = route.startsWith('#/remote');
const isDisplayWindow = /^#\/s\/[^/]+\/display\//.test(route);

initSettingsSync();
if (!isPhoneRemote) void useLibrary.getState().init();
if (!isPhoneRemote && !isDisplayWindow) initRemoteHostService();
void initPwa();

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
