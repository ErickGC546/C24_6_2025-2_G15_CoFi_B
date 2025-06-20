'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

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
    <nav className="w-full bg-gray-900 text-white px-4 py-3 shadow">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link href="/" className="flex items-center text-xl font-bold gap-2">
          <img
            src="/img/logo.png"
            alt="Logo"
            className="w-8 h-8"
          />
          <span className="text-green-500 hover:text-green-400 transition-colors">CoFi</span>
        </Link>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt="Foto de perfil"
                  className="w-8 h-8 rounded-full border border-green-400 object-cover"
                />
              )}
              <span className="font-medium text-sm">{user.displayName || user.email}</span>
              <button
                onClick={handleLogout}
                className="ml-2 px-3 py-1 rounded bg-green-500 hover:bg-green-600 text-white font-semibold transition"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link href="/login">
                <span className="cursor-pointer">Iniciar sesión</span>
              </Link>
              <Link href="/register">
                <span className="cursor-pointer">Registrarse</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}