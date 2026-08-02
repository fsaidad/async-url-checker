import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setupListeners } from '@reduxjs/toolkit/query';

import { App } from './app/App';
import { AppProviders } from './app/providers';
import { appStore } from './app/store';
import './app/styles/global.css';

const root = document.querySelector<HTMLDivElement>('#root');
if (root === null) throw new Error('Root element was not found');

setupListeners(appStore.dispatch);

createRoot(root).render(
  <StrictMode>
    <AppProviders store={appStore}>
      <App />
    </AppProviders>
  </StrictMode>,
);
