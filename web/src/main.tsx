// SPDX-License-Identifier: Apache-2.0
// Two entry points: the landing page at "/" and the app at "/app". Each is code-split so the landing
// page's motion libraries are not shipped to the app and vice versa.
import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

const Landing = lazy(() => import('./landing/Landing'));
const AppEntry = lazy(() => import('./app/AppEntry'));

const isApp = window.location.pathname.replace(/\/+$/, '').startsWith('/app');

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={null}>{isApp ? <AppEntry /> : <Landing />}</Suspense>
  </React.StrictMode>,
);
