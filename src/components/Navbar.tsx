'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  return (
    <nav className="w-full bg-gray-900 text-white px-4 py-3 shadow sticky top-0 z-50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold">
          <Image
            src="/img/logo.png"
            alt="Logo"
            width={32}
            height={32}
            className="w-8 h-8"
          />
          <span className="text-green-500 hover:text-green-400 transition-colors">CoFi</span>
        </Link>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-3 text-sm sm:flex-nowrap">
          {user ? (
            <>
              {user.photoURL && (
                <Image
                  src={user.photoURL}
                  alt="Foto de perfil"
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full border border-green-400 object-cover"
                />
              )}
              <span className="font-medium text-center text-xs sm:text-sm">
                {user.displayName || user.email}
              </span>
              <button
                onClick={handleLogout}
                className="w-full rounded bg-green-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-600 sm:w-auto"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link href="/login">
                <span className="inline-flex w-full cursor-pointer justify-center rounded border border-green-500 px-4 py-2 text-sm font-semibold text-green-400 transition hover:border-green-400 hover:text-green-300 sm:w-auto">
                  Iniciar sesión
                </span>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
