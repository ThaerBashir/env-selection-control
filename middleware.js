import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export default clerkMiddleware(async () => NextResponse.next());

export const config = {
  matcher: ['/'],
};
