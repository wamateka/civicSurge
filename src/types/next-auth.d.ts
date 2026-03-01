import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: 'VOLUNTEER' | 'ADMIN';
    };
  }

  interface User {
    id: string;
    role: 'VOLUNTEER' | 'ADMIN';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'VOLUNTEER' | 'ADMIN';
  }
}
