/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { OnlineDiagnosticData } from '../types/murosLocos';
import { onlineService } from '../game/onlineService';

export const OnlineDiagnosticsOverlay: React.FC = () => {
  const [data, setData] = useState<OnlineDiagnosticData>(() => onlineService.getDiagnosticData());
  const [expandido, setExpandido] = useState(false);

  useEffect(() => {
    const unsubscribe = onlineService.subscribeDiagnostics((fresh) => {
      setData(fresh);
    });
    return unsubscribe;
  }, []);

  // Don't render if completely idle and no peer
  if (data.status === 'desconectado' && data.role === 'none' && data.logs.length === 0) {
    return null;
  }

  const getStatusColor = () => {
    switch (data.status) {
      case 'conectado':
        return 'bg-[#51cf66] text-[#134e20]';
      case 'negociando':
        return 'bg-[#ffd43b] text-[#5c3c00]';
      case 'reconectando':
        return 'bg-[#ff922b] text-[#6d2500]';
      default:
        return 'bg-[#ced4da] text-[#495057]';
    }
  };

  const getQualityBars = () => {
    let count = 0;
    if (data.calidad === 'excelente') count = 4;
    else if (data.calidad === 'buena') count = 3;
    else if (data.calidad === 'inestable') count = 2;
    else if (data.calidad === 'critica') count = 1;

    return (
      <div className="flex items-end gap-0.5 h-3.5">
        {[1, 2, 3, 4].map((bar) => (
          <div
            key={bar}
            className={`w-1 rounded-xs transition-all ${
              bar <= count
                ? count >= 3
                  ? 'bg-[#2b8a3e]'
                  : count === 2
                  ? 'bg-[#f59f00]'
                  : 'bg-[#e03131]'
                : 'bg-black/15'
            }`}
            style={{ height: `${bar * 25}%` }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="fixed bottom-3 left-3 z-50 select-none font-sans">
      {/* Compact Status Pill */}
      <div className="flex items-center gap-1.5 p-1.5 bg-[#fff8e7] border-2 border-[#2b2140] rounded-2xl shadow-[0_4px_0_#2b2140] text-xs">
        {/* Pulsing Status Dot */}
        <div className="relative flex items-center justify-center w-3 h-3 ml-1">
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
              data.status === 'conectado'
                ? 'bg-[#51cf66] animate-ping'
                : data.status === 'negociando'
                ? 'bg-[#ffd43b] animate-ping'
                : 'bg-[#ff6b6b]'
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2.5 w-2.5 border border-[#2b2140] ${getStatusColor()}`}
          />
        </div>

        {/* Signal Bars */}
        {getQualityBars()}

        {/* Ping latency */}
        <span className="font-mono-num font-black text-[11px] text-[#2b2140]">
          {data.pingMs !== null ? `${data.pingMs} ms` : 'P2P WebRTC'}
        </span>

        {/* Toggle Inspector Button */}
        <button
          type="button"
          onClick={() => setExpandido(!expandido)}
          className={`py-0.5 px-2 rounded-xl text-[10px] font-black border border-[#2b2140] transition-colors cursor-pointer ${
            expandido
              ? 'bg-[#2b2140] text-white'
              : 'bg-white text-[#2b2140] hover:bg-[#ede4d0]'
          }`}
          title="Ver diagnóstico detallado de conexión"
        >
          {expandido ? '✕' : 'ⓘ Red'}
        </button>
      </div>

      {/* Expanded Diagnostic Drawer */}
      {expandido && (
        <div className="mt-2 w-80 max-w-[90vw] bg-[#fff8e7] border-3 border-[#2b2140] rounded-2xl p-3 shadow-[0_8px_0_#2b2140,0_16px_25px_rgba(0,0,0,0.35)] flex flex-col gap-2.5 animate-[slideUp_0.15s_ease-out]">
          <div className="flex items-center justify-between pb-1.5 border-b-2 border-[#2b2140]/15">
            <div className="flex items-center gap-1.5">
              <span className="text-base">📡</span>
              <span className="font-black text-xs text-[#2b2140]">Diagnóstico de Red PeerJS</span>
            </div>
            <button
              type="button"
              onClick={() => onlineService.sendInstantDiagnosticPing()}
              className="py-0.5 px-2 bg-white rounded-lg border border-[#2b2140] text-[10px] font-black hover:bg-[#fff9db] cursor-pointer"
              title="Medir latencia en este instante"
            >
              🔄 Ping
            </button>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <div className="p-1.5 bg-white rounded-xl border border-[#2b2140]/25">
              <span className="text-[9px] font-bold text-[#86542d] block">Estado Conexión</span>
              <span className="font-black text-[#2b2140] capitalize">{data.status}</span>
            </div>
            <div className="p-1.5 bg-white rounded-xl border border-[#2b2140]/25">
              <span className="text-[9px] font-bold text-[#86542d] block">Latencia RTT</span>
              <span className="font-black font-mono-num text-[#2b8a3e]">
                {data.pingMs !== null ? `${data.pingMs} ms` : 'Calculando...'}
              </span>
            </div>
            <div className="p-1.5 bg-white rounded-xl border border-[#2b2140]/25">
              <span className="text-[9px] font-bold text-[#86542d] block">Rol de Sesión</span>
              <span className="font-black text-[#2b2140] uppercase">
                {data.role === 'host' ? '👑 Anfitrión' : data.role === 'client' ? '🎮 Cliente' : 'Ninguno'}
              </span>
            </div>
            <div className="p-1.5 bg-white rounded-xl border border-[#2b2140]/25">
              <span className="text-[9px] font-bold text-[#86542d] block">Calidad Enlace</span>
              <span className="font-black text-[#2b2140] capitalize">{data.calidad}</span>
            </div>
          </div>

          {/* Peer IDs */}
          <div className="p-2 bg-white rounded-xl border border-[#2b2140]/25 text-[10px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#86542d]">Mi PeerID:</span>
              <span className="font-mono text-[#2b2140] font-black truncate max-w-[170px]" title={data.miPeerId}>
                {data.miPeerId || 'Iniciando...'}
              </span>
            </div>
            {data.rivalPeerId && (
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#86542d]">Rival PeerID:</span>
                <span className="font-mono text-[#2b2140] font-black truncate max-w-[170px]" title={data.rivalPeerId}>
                  {data.rivalPeerId}
                </span>
              </div>
            )}
          </div>

          {/* Event Log Terminal */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-[#593922] uppercase tracking-wider">
              Registro de Conexión (Logs):
            </span>
            <div className="bg-[#1a1b1e] text-[#d0ebff] font-mono rounded-xl p-2 max-h-28 overflow-y-auto text-[9px] space-y-1">
              {data.logs.length === 0 ? (
                <span className="text-gray-400 italic">Sin eventos registrados aún</span>
              ) : (
                data.logs.map((log, idx) => (
                  <div key={idx} className="leading-tight">
                    <span className="text-[#ffd43b]">[{log.ts}] </span>
                    <span
                      className={
                        log.tipo === 'error'
                          ? 'text-[#ff8787] font-bold'
                          : log.tipo === 'warn'
                          ? 'text-[#ffe066]'
                          : 'text-[#a5d8ff]'
                      }
                    >
                      {log.mensaje}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
