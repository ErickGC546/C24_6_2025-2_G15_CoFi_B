'use client';

import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showAppDownload, setShowAppDownload] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const token = await user.getIdToken();
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();

          if (data.role === 'usuario') {
            setShowAppDownload(true);
          }
        } catch (error) {
          console.error('Error checking user role:', error);
        }
      } else {
        setShowAppDownload(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (err) {
      console.error(err);
      setError('Credenciales inválidas');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' }); // fuerza elegir cuenta

      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (user.email && user.email.endsWith('@tecsup.edu.pe')) {
        const token = await user.getIdToken();

        const res = await fetch('/api/auth/me', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          console.error('Error en /api/auth/me', await res.text());
          setError('Hubo un problema al registrar el usuario.');
          return;
        }

        console.log("✅ Usuario autenticado correctamente");

        router.push('/');
      } else {
        await signOut(auth);
        setError('Solo se permiten correos de Tecsup con el botón de Google');
      }
    } catch (err) {
      console.error('Error con Google:', err);
      setError('Error al iniciar sesión con Google');
    }
  };
  
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030c06] text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(circle at 10% 20%, rgba(34,197,94,0.3), transparent 50%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.08), transparent 45%)'
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 lg:flex-row lg:items-stretch">
        <section className="flex flex-1 flex-col justify-between gap-8 rounded-3xl bg-[#08150f]/70 p-8 text-center backdrop-blur lg:text-left">
          <div className="space-y-6">
            <div className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-xs font-semibold tracking-[0.35em] text-emerald-300 lg:justify-start">
              COFI
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            </div>
            <div className="space-y-4">
              <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl" style={{ fontFamily: 'Space Grotesk, Sora, sans-serif' }}>
                Ingresa y sincroniza tu vida financiera en un solo panel.
              </h1>
              <p className="text-base text-emerald-100/80">
                COFI combina registro por voz, metas compartidas e inteligencia predictiva hecha para comunidades Tecsup. Mantén el mismo lenguaje visual de la app desde el primer acceso.
              </p>
            </div>
            <ul className="space-y-3 text-sm text-emerald-100/80">
              <li className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />Alertas inteligentes cuando un gasto se dispara.
              </li>
              <li className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />Equipos colaborativos con reportes listos para compartir.
              </li>
              <li className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />Seguridad respaldada por Firebase y cifrado extremo.
              </li>
            </ul>
          </div>
        </section>

        <section className="flex-1 rounded-3xl bg-white/95 p-6 text-[#0c1d14] shadow-[0_25px_80px_rgba(0,0,0,0.35)] sm:p-8">
          <div className="mb-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-emerald-600">Acceso</p>
            <h2 className="text-2xl font-semibold text-[#0c1d14]" style={{ fontFamily: 'Space Grotesk, Sora, sans-serif' }}>
              Inicia sesión con tu cuenta Tecsup
            </h2>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-semibold text-[#0a1a11]">Correo electrónico</label>
              <input
                id="email"
                type="email"
                placeholder="ejemplo@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-emerald-100 bg-white/80 p-3 text-sm text-[#0c1d14] placeholder:text-emerald-300 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#0a1a11]">
                <label htmlFor="password">Contraseña</label>
                <button
                  type="button"
                  className="text-emerald-600 transition hover:text-emerald-500"
                  tabIndex={-1}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <input
                id="password"
                type="password"
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-emerald-100 bg-white/80 p-3 text-sm text-[#0c1d14] placeholder:text-emerald-300 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-2xl bg-[#082214] px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              Iniciar sesión
            </button>
            {error && (
              <p className="text-center text-sm text-red-500">{error}</p>
            )}
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-emerald-50" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-emerald-400">o</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-semibold text-[#0c1d14] shadow-sm transition hover:border-emerald-300 hover:-translate-y-0.5"
            type="button"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Ingresa con tu correo de Tecsup
          </button>
        </section>
      </div>
    </div>
  );
}
