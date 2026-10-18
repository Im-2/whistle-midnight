// SPDX-License-Identifier: Apache-2.0
// Placeholder until the landing page is built: send visitors straight to the app.
import { useEffect } from 'react';

export default function Landing() {
  useEffect(() => {
    window.location.replace('/app');
  }, []);
  return null;
}
