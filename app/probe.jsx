'use client';

import { useEffect, useState } from 'react';

export default function Probe({ serverValue }) {
  const clientValue = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  return (
    <main>
      <h1>Environment selection control</h1>
      <p>This test uses synthetic configuration only.</p>
      <p>Server reference: <output id="server-probe">{serverValue ?? 'UNSET'}</output></p>
      <p>Client reference: <output id="env-probe">{clientValue ?? 'UNSET'}</output></p>
      <p>References agree: <output id="probe-match">{serverValue === clientValue ? 'MATCH' : 'NO MATCH'}</output></p>
      <p>Hydrated: <output id="hydrated">{hydrated ? 'YES' : 'NO'}</output></p>
    </main>
  );
}
