import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'Socket.io initialized on custom server',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  });
}
