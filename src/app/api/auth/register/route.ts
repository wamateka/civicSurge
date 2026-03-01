import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, role, phone, skills, resources, latitude, longitude, address } = body;

    if (!email || !password || !name || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        role: role === 'ADMIN' ? 'ADMIN' : 'VOLUNTEER',
      },
    });

    if (role === 'VOLUNTEER') {
      if (!phone || !skills || latitude === undefined || longitude === undefined) {
        // Rollback user if volunteer data is missing
        await prisma.user.delete({ where: { id: user.id } });
        return NextResponse.json(
          { error: 'Missing volunteer fields: phone, skills, latitude, longitude' },
          { status: 400 }
        );
      }

      await prisma.volunteer.create({
        data: {
          userId: user.id,
          phone,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          ...(address ? { address } : {}),
          skills: Array.isArray(skills) ? skills : [skills],
          resources: Array.isArray(resources) ? resources : [],
          isAvailable: true,
        },
      });
    }

    return NextResponse.json(
      { message: 'Registration successful', userId: user.id, role: user.role },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Register] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
