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

  const handleDownloadApp = () => {
    // Reemplaza con la URL real de tu app
    window.open('https://drive.google.com/drive/u/2/folders/1U1kCOzs93iS89azrcBKjqPgEEK85D-g0', '_blank');
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-green-100 inline-block p-4 rounded-full mb-3 shadow">
            <div className="text-3xl font-bold text-green-600 tracking-wide">COFI</div>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Bienvenido</h1>
          <p className="text-sm text-gray-400 mt-1">
            Maneja tus finanzas de forma consciente y colaborativa
          </p>
        </div>

        {/* Botón de descarga - solo visible para usuarios regulares */}
        {showAppDownload && (
          <div className="mb-6">
            <button
              onClick={handleDownloadApp}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-xl font-bold text-lg shadow-lg hover:from-green-600 hover:to-green-700 transition flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              📱 Descarga la App aquí
            </button>
          </div>
        )}

        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-semibold text-gray-800">Correo electrónico</label>
              <input
                id="email"
                type="email"
                placeholder="tu@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-green-400 bg-white placeholder:text-gray-400"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-semibold text-gray-800">Contraseña</label>
                <button
                  type="button"
                  className="text-xs text-green-600 hover:underline px-0 bg-transparent"
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
                className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-2 focus:ring-green-400 bg-white placeholder:text-gray-400"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-green-500 text-white p-2 rounded font-semibold hover:bg-green-600 transition"
            >
              Iniciar sesión
            </button>
            {error && (
              <p className="text-red-600 text-sm text-center">{error}</p>
            )}
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-400">o</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center bg-white border border-gray-300 rounded p-2 font-semibold shadow-sm hover:bg-green-50 transition"
            type="button"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
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
        </div>
      </div>
    </div>
  );
}
