import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function fail(msg) {
  // eslint-disable-next-line no-console
  console.error(msg);
  process.exit(1);
}

try {
  require.resolve('next/package.json');
} catch {
  fail(
    [
      '',
      '[astro-react-interface] Next.js is not installed (next: not found).',
      '',
      'Fix:',
      '  1) From repo root: npm install',
      '  2) Then: npm run dev:ui  (or npm run dev)',
      '',
      'If install fails with ETIMEDOUT:',
      '  - check your proxy settings: npm config get proxy && npm config get https-proxy',
      '  - consider switching registry temporarily',
      '',
    ].join('\n'),
  );
}

