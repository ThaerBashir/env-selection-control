# Clerk environment selection control

This small Next.js app checks whether an explicit public environment reference reaches the Clerk script attribute unchanged. It uses `ClerkProvider dynamic`, a direct `process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` prop and Clerk middleware with a public homepage. It contains no real credentials or account data.

The middleware is a generic public-root example. It includes no application-specific routes or authentication features.

The original static control remains on `main`. This branch adds Clerk for a separate comparison.

## Versions

- Node.js 22.x and Next.js 15.5.24
- React and React DOM 19.3.1
- `@clerk/nextjs` 6.39.6
- Pinned overrides: backend 2.33.6, shared 3.47.8, clerk-react 5.61.9

## Local check

With Node.js 22, run `npm ci` and `npm run check:local`.

The check makes two clean production builds with synthetic `pk_test_` strings encoding `env-control-general.invalid$` and `env-control-branch.invalid$`. It starts each build with the other dummy value. It then checks that the original HTML has exactly one Clerk key attribute and that it matches both direct public references and the build input. The build must classify the homepage as dynamic.

There are two signed-out request checks. A non-document HTTP request reaches the Provider without cookies. A document request uses only a synthetic development-browser marker cookie. This marker does not create a signed-in session. A clean document request without that marker redirects to the nonexistent `.invalid` authentication host; the check records the redirect without following it.

The dummy secret is a fixed invalid string. Every request remains signed out. Results and build logs are written to the ignored `results/` directory. The script clears inherited Clerk configuration from its child-process environment.

## Remote test inputs

Use only synthetic configuration. Do not copy values from another application.

| Variable | Scope | Synthetic value |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | General | `pk_test_ZW52LWNvbnRyb2wtZ2VuZXJhbC5pbnZhbGlkJA==` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Preview, branch `probe/branch` | `pk_test_ZW52LWNvbnRyb2wtYnJhbmNoLmludmFsaWQk` |
| `CLERK_SECRET_KEY` | Preview | `sk_test_SYNTHETIC_ONLY_NEVER_VALID_00000000` |

This fixture cannot load a real Clerk browser runtime or test authentication with these inputs. A correct result only covers the tested configuration and request paths. It does not explain a different application's output.

Public references: [Vercel Preview variables](https://vercel.com/docs/environment-variables#preview-environment-variables), [Next.js public variables](https://nextjs.org/docs/15/app/guides/environment-variables#bundling-environment-variables-for-the-browser), [Clerk Provider source for this release](https://github.com/clerk/javascript/blob/6ff18352535102f4b2fb09f96856724da1aff3bf/packages/nextjs/src/app-router/server/ClerkProvider.tsx).
