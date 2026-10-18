// SPDX-License-Identifier: Apache-2.0
// Routes: "/" is the landing page; "/app" is the working app; "/run-locally" explains how to run it.
//
// The public static site is built with VITE_PUBLIC_SITE=true. In that build the app is not imported at all
// (the condition below is a compile-time constant, so the bundler drops it): the deployed site contains no
// app code and nothing that talks to a gateway.
import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

const Landing = lazy(() => import('./landing/Landing'));
const RunLocally = lazy(() => import('./landing/RunLocally'));
const AppEntry = import.meta.env.VITE_PUBLIC_SITE === 'true' ? null : lazy(() => import('./app/AppEntry'));

const path = window.location.pathname.replace(/\/+$/, '');
const View = path.startsWith('/run-locally') ? RunLocally : path.startsWith('/app') && AppEntry ? AppEntry : Landing;

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={null}>
      <View />
    </Suspense>
  </React.StrictMode>,
);
