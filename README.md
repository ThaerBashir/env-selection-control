# Environment selection control

This small Next.js app checks a direct public environment-variable reference in a Server Component and a Client Component. It uses the key name `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` but does not install Clerk or use any real Clerk configuration.

Use only synthetic strings with this app. Do not copy credentials or configuration from another project.

## Local check

Use Node.js 22, install with `npm ci`, then run `npm run check:local`.

The check builds the app three times and verifies the exact rendered output elements through `next start`:

1. Build with `CONTROL_GENERAL_PREVIEW`, start with `CONTROL_BRANCH_PREVIEW`, expect the build value.
2. Rebuild with `CONTROL_BRANCH_PREVIEW`, start with `CONTROL_GENERAL_PREVIEW`, expect the new build value.
3. Build with the key absent, start with `CONTROL_GENERAL_PREVIEW`, expect `UNSET` in the prerendered page.

The expected strings live in the check script, not in the application. Local results and build logs are written to the ignored `results/` directory. The page also shows whether client hydration has completed, but the automated local check reads the original HTML only.

## Git Preview check

In a separate Vercel test project, create the following synthetic records:

| Key | Scope | Dummy value |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Development, Preview, Production | `CONTROL_GENERAL_PREVIEW` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Preview, branch `probe/branch` | `CONTROL_BRANCH_PREVIEW` |

After the initial Production build on `main`, push `probe/general` and `probe/branch` through the connected Git integration. Inspect both the original HTML and the hydrated page on each immutable Preview URL. The unscoped branch should show the general marker; the scoped branch should show the branch marker. Retain the deployment IDs, branch names, commit SHAs and build/cache results.

This is an independent control. Passing does not prove another project's configuration was selected correctly or explain another app's output.

Public references: [Vercel Preview variables](https://vercel.com/docs/environment-variables#preview-environment-variables), [Next.js public environment variables](https://nextjs.org/docs/15/app/guides/environment-variables#bundling-environment-variables-for-the-browser).
