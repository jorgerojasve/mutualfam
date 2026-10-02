import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Smartphone } from 'lucide-react';

export default function InviteLanding() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-6 text-center">
        <h1 className="text-3xl font-bold text-slate-100 mb-4">Enlace Inválido</h1>
        <p className="text-slate-400">El enlace de invitación no contiene un token válido.</p>
      </div>
    );
  }

  // Apuntamos al APK servido estáticamente desde la carpeta public/
  const downloadApkLink = "/mutualfam-release.apk";
  const deepLink = `mutualfam://join/${token}`;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-6 font-sans">
      <div className="bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-8 border border-slate-700">
        
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Smartphone className="text-white w-8 h-8" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-2">
          ¡Te han invitado a Mutual Familiar!
        </h1>
        <p className="text-slate-400 text-center mb-8">
          Sigue estos dos pasos para aceptar la invitación y unirte a la mutual.
        </p>

        <div className="space-y-6">
          {/* Paso 1 */}
          <div className="relative">
            <div className="flex items-center mb-2">
              <div className="bg-slate-700 text-slate-300 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold mr-3">1</div>
              <h2 className="text-lg font-semibold text-slate-200">Descarga la App</h2>
            </div>
            <p className="text-sm text-slate-400 mb-3 ml-9">
              Si aún no tienes la aplicación instalada en tu teléfono, descárgala primero.
            </p>
            <a 
              href={downloadApkLink}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-9 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white py-3 px-4 rounded-lg transition-colors font-medium"
            >
              <Download className="w-5 h-5 mr-2" />
              Descargar APK
            </a>
          </div>

          <div className="border-t border-slate-700 my-2 ml-9"></div>

          {/* Paso 2 */}
          <div className="relative">
            <div className="flex items-center mb-2">
              <div className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold mr-3">2</div>
              <h2 className="text-lg font-semibold text-slate-200">Abre la Invitación</h2>
            </div>
            <p className="text-sm text-slate-400 mb-3 ml-9">
              Una vez instalada la app, haz clic aquí para abrirla y registrarte.
            </p>
            <a 
              href={deepLink}
              className="ml-9 flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white py-3 px-4 rounded-lg transition-colors font-medium shadow-lg shadow-blue-500/20"
            >
              Unirme a la Mutual
            </a>
          </div>
        </div>

      </div>
      
      <p className="text-slate-500 text-sm mt-8">
        Plataforma Cívica Mutual Familiar
      </p>
    </div>
  );
}
