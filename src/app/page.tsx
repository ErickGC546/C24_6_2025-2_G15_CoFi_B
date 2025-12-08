'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import AutoCarousel from '@/components/home/AutoCarousel';
import UserWelcome from '@/components/home/UserWelcome';
import AdminDashboard from '@/components/admin/AdminDashboard';

interface Profile {
  id?: string;
  email?: string | null;
  name?: string | null;
  role?: string;
  aiCreditsRemaining?: number;
}

export default function HomePage() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setProfile(null);
        return;
      }

      try {
        setLoadingProfile(true);
        const token = await auth.currentUser?.getIdToken();

        const res = await fetch('/api/auth/me', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (!res.ok) {
          console.error('Error obteniendo perfil:', res.status, await res.text());
          setProfile(null);
          return;
        }

        const data = await res.json();
        setProfile(data);
      } catch (err) {
        console.error('Error cargando perfil:', err);
        setProfile(null);
      } finally {
        setLoadingProfile(false);
      }
    }

    loadProfile();
  }, [user]);

  // No autenticado - mostrar carrusel de bienvenida
  if (!user) {
    return <AutoCarousel />;
  }

  // Cargando perfil
  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  // Admin - mostrar dashboard administrativo
  if (profile && profile.role === 'admin') {
    return (
      <AdminDashboard 
        userName={profile.name || user.displayName || 'Administrador'}
      />
    );
  }

  // Usuario normal - mostrar bienvenida con carrusel
  return (
    <UserWelcome 
      userName={profile?.name || user.displayName || 'Usuario'} 
    />
  );
}
