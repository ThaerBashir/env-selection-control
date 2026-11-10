import { ClerkProvider } from '@clerk/nextjs';

export const metadata = { title: 'Clerk environment selection control' };

export default function RootLayout({ children }) {
  return (
    <ClerkProvider
      dynamic
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
    >
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
