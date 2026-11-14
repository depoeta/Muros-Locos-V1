import React from 'react';
import { AvatarTipoDeAura, AvatarTipoDeGorro, AvatarTipoDeRopa } from '../types/murosLocos';

interface CartoonCharacterProps {
  color: string;
  hat: AvatarTipoDeGorro;
  ropa?: AvatarTipoDeRopa;
  ropaColor?: string;
  aura?: AvatarTipoDeAura;
  size?: number;
  isActive?: boolean;
  isDancing?: boolean;
  className?: string;
  showShadow?: boolean;
  inGame?: boolean;
}

export const CartoonCharacter: React.FC<CartoonCharacterProps> = ({
  color,
  hat,
  ropa = 'ninguna',
  ropaColor,
  aura = 'ninguna',
  size = 56,
  isActive = false,
  isDancing = false,
  className = '',
  showShadow = true,
  inGame = false,
}) => {
  const uid = React.useId().replace(/:/g, '');
  const isRobot = hat === 'robot' || hat === 'bot_cpu';
  const isNinja = hat === 'ninja';
  const isDragon = hat === 'dragon';

  // Si lleva ropa frontal (tuxedo, armadura, túnica, cinturón), desplazamos la cara
  // ligeramente hacia arriba para abrir un torso proporcionado sin choques con la boca/mejillas.
  const usaRopaFrontal =
    ropa === 'armadura' ||
    ropa === 'tuxedo' ||
    ropa === 'tunica' ||
    ropa === 'cinturon';
  const faceY = usaRopaFrontal ? -6.5 : 0;

  // Si está en partida (inGame), el aura solo resplandece cuando le toca jugar al jugador
  const mostrarAura = !inGame || isActive;

  // Colores personalizables de ropa
  const colCapa = ropaColor || '#c92a2a';
  const colArmadura = ropaColor || '#adb5bd';
  const colTunica = ropaColor || '#5f3dc4';
  const colTuxedo = ropaColor || '#212529';
  const colCinturon = ropaColor || '#fab005';
  const colAlas = ropaColor || '#e7f5ff';

  const bodyClipId = `bodyClip-${uid}`;
  const headWrapClipId = `headWrapClip-${uid}`;
  const dragonScalesId = `dragonScales-${uid}`;
  const auraGoldId = `auraGoldGrad-${uid}`;
  const auraFireId = `auraFireGrad-${uid}`;
  const auraCyberId = `auraCyberGrad-${uid}`;
  const auraRainbowId = `auraRainbowGrad-${uid}`;

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        className={`w-full h-full overflow-visible transition-transform duration-300 ${
          isDancing ? 'animate-bounce' : isActive ? 'animate-pulse scale-105' : ''
        }`}
      >
        <defs>
          {/* Recorte exacto del cuerpo esférico para que la ropa y escamas abracen la silueta */}
          <clipPath id={bodyClipId}>
            <circle cx="50" cy="54" r="30.8" />
          </clipPath>

          {/* Recorte suave para cintas/máscaras alrededor de la cabeza */}
          <clipPath id={headWrapClipId}>
            <circle cx="50" cy="54" r="32.2" />
          </clipPath>

          {/* Patrón de escamas de dragón repartido por todo el cuerpo */}
          <pattern id={dragonScalesId} width="12" height="10" patternUnits="userSpaceOnUse">
            <path
              d="M 0 1.5 Q 3 6 6 1.5 Q 9 6 12 1.5"
              fill="#1e1830"
              fillOpacity="0.06"
              stroke="#1e1830"
              strokeWidth="1.3"
              strokeOpacity="0.34"
              strokeLinecap="round"
            />
            <path
              d="M -6 6.5 Q -3 11 0 6.5 Q 3 11 6 6.5 Q 9 11 12 6.5 Q 15 11 18 6.5"
              fill="#ffffff"
              fillOpacity="0.07"
              stroke="#1e1830"
              strokeWidth="1.3"
              strokeOpacity="0.32"
              strokeLinecap="round"
            />
          </pattern>

          {/* Aura Dorada Potente */}
          <radialGradient id={auraGoldId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff9db" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#ffd43b" stopOpacity="0.7" />
            <stop offset="80%" stopColor="#f59f00" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ffd43b" stopOpacity="0" />
          </radialGradient>

          {/* Aura Fuego */}
          <radialGradient id={auraFireId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffc078" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#ff922b" stopOpacity="0.65" />
            <stop offset="80%" stopColor="#f03e3e" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#c92a2a" stopOpacity="0" />
          </radialGradient>

          {/* Aura Cíber */}
          <radialGradient id={auraCyberId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#99e9f2" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#22b8cf" stopOpacity="0.65" />
            <stop offset="80%" stopColor="#15aabf" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0c8599" stopOpacity="0" />
          </radialGradient>

          {/* Aura Arcoíris Estática (Halo cósmico difuso sin giro/mareo) */}
          <radialGradient id={auraRainbowId} cx="50%" cy="50%" r="50%">
            <stop offset="35%" stopColor="#ffe066" stopOpacity="0.8" />
            <stop offset="52%" stopColor="#69db7c" stopOpacity="0.65" />
            <stop offset="68%" stopColor="#4dabf7" stopOpacity="0.65" />
            <stop offset="84%" stopColor="#da77f2" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ff8787" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ============================================================== */}
        {/* AURAS (Detrás del cuerpo) */}
        {/* ============================================================== */}
        {mostrarAura && (
          <g className="transition-opacity duration-300">
            {aura === 'dorada' && (
              <circle
                cx="50"
                cy="54"
                r="47"
                fill={`url(#${auraGoldId})`}
                style={{ filter: 'drop-shadow(0 0 10px rgba(255, 212, 59, 0.75))' }}
                className={isActive ? 'animate-pulse' : ''}
              />
            )}
            {aura === 'fuego' && (
              <circle
                cx="50"
                cy="54"
                r="46"
                fill={`url(#${auraFireId})`}
                style={{ filter: 'drop-shadow(0 0 8px rgba(240, 62, 62, 0.6))' }}
                className={isActive ? 'animate-pulse' : ''}
              />
            )}
            {aura === 'ciber' && (
              <circle
                cx="50"
                cy="54"
                r="46"
                fill={`url(#${auraCyberId})`}
                style={{ filter: 'drop-shadow(0 0 8px rgba(34, 184, 207, 0.6))' }}
                className={isActive ? 'animate-pulse' : ''}
              />
            )}
            {aura === 'arcoiris' && (
              <circle
                cx="50"
                cy="54"
                r="48"
                fill={`url(#${auraRainbowId})`}
                style={{ filter: 'drop-shadow(0 0 9px rgba(186, 120, 255, 0.55))' }}
              />
            )}
          </g>
        )}

        {/* ============================================================== */}
        {/* ROPA TRASERA: CAPA Y ALAS (Nacen de la espalda media/baja) */}
        {/* ============================================================== */}
        {ropa === 'capa' && (
          <g>
            <path
              d="M 27 52 Q 10 76 18 90 L 82 90 Q 90 76 73 52 Z"
              fill={colCapa}
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <path d="M 23 88 L 77 88" stroke="#ffd43b" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 38 60 Q 32 75 36 88" stroke="#000000" strokeWidth="1.8" strokeOpacity="0.25" fill="none" />
            <path d="M 62 60 Q 68 75 64 88" stroke="#000000" strokeWidth="1.8" strokeOpacity="0.25" fill="none" />
          </g>
        )}

        {ropa === 'alas' && (
          <g>
            <path
              d="M 28 54 C 8 46 0 62 4 78 C 14 82 22 72 30 64 Z"
              fill={colAlas}
              stroke="#2b2140"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path d="M 8 62 C 16 66 22 68 28 62" stroke="#74c0fc" strokeWidth="2" fill="none" />
            <path
              d="M 72 54 C 92 46 100 62 96 78 C 86 82 78 72 70 64 Z"
              fill={colAlas}
              stroke="#2b2140"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path d="M 92 62 C 84 66 78 68 72 62" stroke="#74c0fc" strokeWidth="2" fill="none" />
          </g>
        )}

        {/* Sombra inferior en el suelo */}
        {showShadow && (
          <ellipse cx="50" cy="92" rx="28" ry="7" fill="#2b2140" opacity="0.25" />
        )}

        {/* Patitas */}
        <ellipse cx="36" cy="87" rx="10" ry="6" fill="#ffd43b" stroke="#2b2140" strokeWidth="3.5" />
        <ellipse cx="64" cy="87" rx="10" ry="6" fill="#ffd43b" stroke="#2b2140" strokeWidth="3.5" />

        {/* Relleno del Cuerpo Principal */}
        <circle cx="50" cy="54" r="32" fill={color} />

        {/* ============================================================== */}
        {/* TEXTURA DE ESCAMAS DE DRAGÓN EN TODO EL CUERPO */}
        {/* ============================================================== */}
        {isDragon && (
          <g clipPath={`url(#${bodyClipId})`}>
            {/* Manto completo de escamas por todo el cuerpo */}
            <circle cx="50" cy="54" r="32" fill={`url(#${dragonScalesId})`} />

            {/* Panza crema clara de dragón cuando no lleva ropa frontal que la cubra */}
            {!usaRopaFrontal && (
              <g>
                <path
                  d="M 33 74 Q 50 67 67 74 Q 61 86 50 86 Q 39 86 33 74 Z"
                  fill="#fff3bf"
                  fillOpacity="0.72"
                  stroke="#2b2140"
                  strokeOpacity="0.35"
                  strokeWidth="1.5"
                />
                <path
                  d="M 38 77 Q 50 80 62 77 M 41 81.5 Q 50 84 59 81.5"
                  stroke="#2b2140"
                  strokeOpacity="0.28"
                  strokeWidth="1.3"
                  fill="none"
                  strokeLinecap="round"
                />
              </g>
            )}
          </g>
        )}

        {/* Reflejo especular del cuerpo */}
        <path
          d="M 28 42 A 25 25 0 0 1 54 26"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.58"
        />

        {/* ============================================================== */}
        {/* RASGOS FACIALES (Se elevan suavemente cuando lleva ropa frontal) */}
        {/* ============================================================== */}
        <g transform={`translate(0, ${faceY})`}>
          {/* Mejillas sonrosadas (solo si no es robot) */}
          {!isRobot && (
            <>
              <circle cx="29" cy="62" r="5" fill="#ff8787" opacity="0.6" />
              <circle cx="71" cy="62" r="5" fill="#ff8787" opacity="0.6" />
            </>
          )}

          {/* OJOS (Si es Robot, tiene visor cibernético en su lugar) */}
          {!isRobot && (
            <g className="animate-[blink_4s_ease-in-out_infinite]">
              <ellipse cx="39" cy="50" rx="7" ry="9" fill="#ffffff" stroke="#2b2140" strokeWidth="3" />
              <circle cx="41" cy="50" r="4.5" fill="#2b2140" />
              <circle cx="42.5" cy="48" r="1.8" fill="#ffffff" />

              <ellipse cx="61" cy="50" rx="7" ry="9" fill="#ffffff" stroke="#2b2140" strokeWidth="3" />
              <circle cx="63" cy="50" r="4.5" fill="#2b2140" />
              <circle cx="64.5" cy="48" r="1.8" fill="#ffffff" />
            </g>
          )}

          {/* BOCA / SONRISA (Oculta en Ninja y Robot) */}
          {!isNinja && !isRobot && (
            <path
              d="M 43 64 Q 50 72 57 64"
              fill="none"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          )}
        </g>

        {/* ============================================================== */}
        {/* ROPA DELANTERA RECORTADA AL CONTORNO ESFÉRICO DEL CUERPO */}
        {/* ============================================================== */}
        <g clipPath={`url(#${bodyClipId})`}>
          {ropa === 'armadura' && (
            <g>
              {/* Peto anatómico amplio abrazando el pecho y abdomen */}
              <path
                d="M 18 63 Q 50 68.5 82 63 L 84 89 L 16 89 Z"
                fill={colArmadura}
                stroke="#2b2140"
                strokeWidth="2.8"
              />
              {/* Bisel metálico en el cuello */}
              <path
                d="M 22 65.5 Q 50 70.5 78 65.5"
                stroke="#ffffff"
                strokeWidth="2"
                strokeOpacity="0.55"
                fill="none"
              />
              {/* Placas frontales en V */}
              <path
                d="M 35 68.5 L 44 79 L 56 79 L 65 68.5"
                stroke="#ffffff"
                strokeWidth="1.8"
                strokeOpacity="0.6"
                fill="none"
              />
              {/* Cinturón de la armadura */}
              <path
                d="M 20 80.5 Q 50 84 80 80.5"
                stroke="#2b2140"
                strokeWidth="2.2"
                fill="none"
              />
              {/* Emblema dorado del pecho */}
              <polygon
                points="50,69.5 55,75.5 45,75.5"
                fill="#ffd43b"
                stroke="#2b2140"
                strokeWidth="1.3"
              />
            </g>
          )}

          {ropa === 'tuxedo' && (
            <g>
              {/* Chaqueta de gala que abraza todo el torso inferior */}
              <path
                d="M 18 63 Q 50 67.5 82 63 L 84 89 L 16 89 Z"
                fill={colTuxedo}
                stroke="#2b2140"
                strokeWidth="2.8"
              />
              {/* Camisa blanca de etiqueta en V */}
              <polygon
                points="40,64.5 60,64.5 50,80.5"
                fill="#ffffff"
                stroke="#2b2140"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              {/* Solapas elegantes del esmoquin */}
              <path
                d="M 31 64 L 44 79 L 36 85 Z"
                fill={colTuxedo}
                stroke="#2b2140"
                strokeWidth="1.9"
                strokeLinejoin="round"
              />
              <path
                d="M 69 64 L 56 79 L 64 85 Z"
                fill={colTuxedo}
                stroke="#2b2140"
                strokeWidth="1.9"
                strokeLinejoin="round"
              />
              {/* Pajarita roja con nudo dorado bien visible */}
              <polygon
                points="43.5,65.5 50,68.2 43.5,71"
                fill="#e03131"
                stroke="#2b2140"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <polygon
                points="56.5,65.5 50,68.2 56.5,71"
                fill="#e03131"
                stroke="#2b2140"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <circle cx="50" cy="68.2" r="1.7" fill="#ffd43b" stroke="#2b2140" strokeWidth="0.9" />
              {/* Botones dorados pulidos */}
              <circle cx="50" cy="75.5" r="1.4" fill="#ffd43b" stroke="#2b2140" strokeWidth="0.8" />
              <circle cx="50" cy="80.8" r="1.4" fill="#ffd43b" stroke="#2b2140" strokeWidth="0.8" />
            </g>
          )}

          {ropa === 'cinturon' && (
            <g>
              {/* Cinturón anatómico curvado de borde a borde */}
              <path
                d="M 16 71 Q 50 76.5 84 71 L 84 81 Q 50 86.5 16 81 Z"
                fill={colCinturon}
                stroke="#2b2140"
                strokeWidth="2.5"
              />
              <path d="M 18 72.5 Q 50 78 82 72.5" stroke="#ffd43b" strokeWidth="1.6" fill="none" />
              <path d="M 18 79.5 Q 50 85 82 79.5" stroke="#ffd43b" strokeWidth="1.6" fill="none" />
              {/* Medallón central de Campeón de Oro */}
              <polygon
                points="50,70 57.5,76.8 50,83.6 42.5,76.8"
                fill="#ffd43b"
                stroke="#2b2140"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <circle cx="50" cy="76.8" r="3.2" fill="#e03131" stroke="#2b2140" strokeWidth="1.2" />
              <circle cx="51" cy="75.8" r="1" fill="#ffffff" opacity="0.85" />
            </g>
          )}

          {ropa === 'tunica' && (
            <g>
              {/* Túnica mística fluida abrazando la parte inferior del cuerpo */}
              <path
                d="M 18 63 Q 50 67.5 82 63 L 84 89 L 16 89 Z"
                fill={colTunica}
                stroke="#2b2140"
                strokeWidth="2.6"
              />
              {/* Ribete dorado en cuello en V */}
              <path
                d="M 35 64.2 L 50 71.5 L 65 64.2"
                fill="none"
                stroke="#ffd43b"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Fajín ceremonial con cordón dorado */}
              <path d="M 21 75 Q 50 79.5 79 75" stroke="#ffd43b" strokeWidth="2.6" fill="none" />
              <circle cx="50" cy="76.8" r="2.4" fill="#ffd43b" stroke="#2b2140" strokeWidth="1" />
              {/* Borlas del fajín */}
              <path
                d="M 50 79 L 47.8 84.8 M 50 79 L 52.2 84.8"
                stroke="#ffd43b"
                strokeWidth="1.9"
                strokeLinecap="round"
              />
            </g>
          )}
        </g>

        {/* Contorno exterior del cuerpo siempre nítido encima de la ropa recortada */}
        <circle cx="50" cy="54" r="32" fill="none" stroke="#2b2140" strokeWidth="4" />

        {/* Piezas 3D de Armadura sobre el contorno (hombreras y escudo bajo las mejillas) */}
        {ropa === 'armadura' && (
          <g>
            {/* Hombrera izquierda */}
            <path
              d="M 17 65 Q 19 58.5 27.5 61.5 Q 29.5 70.5 19.5 72.5 Z"
              fill={colArmadura}
              stroke="#2b2140"
              strokeWidth="2.5"
            />
            <circle cx="23.5" cy="65" r="1.4" fill="#ffffff" />
            {/* Hombrera derecha */}
            <path
              d="M 83 65 Q 81 58.5 72.5 61.5 Q 70.5 70.5 80.5 72.5 Z"
              fill={colArmadura}
              stroke="#2b2140"
              strokeWidth="2.5"
            />
            <circle cx="76.5" cy="65" r="1.4" fill="#ffffff" />

            {/* Escudo de Torneo Medieval en el flanco derecho sin tapar la mejilla */}
            <g transform="translate(65, 62) scale(0.92)">
              <path
                d="M 0 0 L 16 0 C 17 12 14 20 8 25 C 2 20 -1 12 0 0 Z"
                fill="#e03131"
                stroke="#2b2140"
                strokeWidth="2.6"
                strokeLinejoin="round"
              />
              <line x1="8" y1="2" x2="8" y2="23" stroke="#ffd43b" strokeWidth="2.5" />
              <line x1="2" y1="8" x2="14" y2="8" stroke="#ffd43b" strokeWidth="2.5" />
              <circle cx="8" cy="8" r="2" fill="#fff9db" />
            </g>
          </g>
        )}

        {/* ============================================================== */}
        {/* SOMBREROS Y ACCESORIOS DE CABEZA */}
        {/* ============================================================== */}
        {hat === 'corona' && (
          <g transform="translate(50, 22)">
            <path
              d="M -22 0 L -16 -18 L -6 -6 L 0 -22 L 6 -6 L 16 -18 L 22 0 Z"
              fill="#ffd43b"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <circle cx="0" cy="-6" r="3" fill="#ff6b6b" stroke="#2b2140" strokeWidth="1.5" />
            <circle cx="-11" cy="-4" r="2.5" fill="#4dabf7" stroke="#2b2140" strokeWidth="1.5" />
            <circle cx="11" cy="-4" r="2.5" fill="#51cf66" stroke="#2b2140" strokeWidth="1.5" />
          </g>
        )}

        {hat === 'pompon' && (
          <g transform="translate(50, 23)">
            <path
              d="M -20 2 C -20 -18 20 -18 20 2 Z"
              fill="#339af0"
              stroke="#2b2140"
              strokeWidth="3.5"
            />
            <path d="M -16 -6 Q 0 -12 16 -6" fill="none" stroke="#ffffff" strokeWidth="3" />
            <rect
              x="-22"
              y="0"
              width="44"
              height="6"
              rx="3"
              fill="#e7f5ff"
              stroke="#2b2140"
              strokeWidth="3"
            />
            <circle cx="0" cy="-18" r="7" fill="#ffffff" stroke="#2b2140" strokeWidth="3" />
          </g>
        )}

        {hat === 'antena' && (
          <g transform="translate(50, 22)">
            <rect
              x="-7"
              y="-2"
              width="14"
              height="5"
              rx="2"
              fill="#ced4da"
              stroke="#2b2140"
              strokeWidth="3"
            />
            <path d="M 0 -2 L 0 -18" fill="none" stroke="#2b2140" strokeWidth="4" strokeLinecap="round" />
            <circle cx="0" cy="-22" r="6.5" fill="#ff6b6b" stroke="#2b2140" strokeWidth="3" />
            <circle cx="2" cy="-24" r="2" fill="#ffffff" />
          </g>
        )}

        {hat === 'brote' && (
          <g transform="translate(50, 22)">
            <path d="M 0 0 Q 3 -12 0 -16" fill="none" stroke="#2b2140" strokeWidth="4" strokeLinecap="round" />
            <path d="M 0 -14 C -12 -16 -12 -6 0 -10 Z" fill="#69db7c" stroke="#2b2140" strokeWidth="3" />
            <path d="M 0 -15 C 14 -18 14 -6 0 -11 Z" fill="#8ce99a" stroke="#2b2140" strokeWidth="3" />
          </g>
        )}

        {hat === 'mago' && (
          <g transform="translate(50, 24)">
            <ellipse cx="0" cy="2" rx="24" ry="6" fill="#5f3dc4" stroke="#2b2140" strokeWidth="3.5" />
            <path
              d="M -16 1 Q -8 -22 14 -30 Q 8 -16 16 1 Z"
              fill="#7950f2"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <path d="M -15 0 Q 0 -4 15 0" fill="none" stroke="#ffd43b" strokeWidth="3" />
            <path
              d="M 14 -32 L 15.5 -29 L 19 -29 L 16.5 -27 L 17.5 -24 L 14 -26 L 10.5 -24 L 11.5 -27 L 9 -29 L 12.5 -29 Z"
              fill="#ffd43b"
              stroke="#2b2140"
              strokeWidth="1.5"
            />
          </g>
        )}

        {hat === 'gatito' && (
          <g>
            <path
              d="M 24 35 L 20 12 L 39 25 Z"
              fill="#f06595"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <path d="M 25 31 L 22 17 L 35 25 Z" fill="#ffdeeb" />
            <path
              d="M 76 35 L 80 12 L 61 25 Z"
              fill="#f06595"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <path d="M 75 31 L 78 17 L 65 25 Z" fill="#ffdeeb" />
            {/* Bigotes alineados a las mejillas */}
            <g transform={`translate(0, ${faceY})`}>
              <path d="M 16 57 L 27 58 M 15 62 L 27 61" stroke="#2b2140" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 84 57 L 73 58 M 85 62 L 73 61" stroke="#2b2140" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          </g>
        )}

        {hat === 'zorro' && (
          <g>
            <path
              d="M 21 34 L 16 7 L 39 24 Z"
              fill="#f76707"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <path d="M 22 28 L 18 13 L 34 23 Z" fill="#fff4e6" />
            <path
              d="M 79 34 L 84 7 L 61 24 Z"
              fill="#f76707"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <path d="M 78 28 L 82 13 L 66 23 Z" fill="#fff4e6" />
            {/* Hocico y bigotes sincronizados con la cara */}
            <g transform={`translate(0, ${faceY})`}>
              <ellipse cx="50" cy="62" rx="7" ry="5" fill="#fff4e6" stroke="#2b2140" strokeWidth="2" />
              <polygon points="47,59 53,59 50,63" fill="#2b2140" />
              <path d="M 18 56 L 28 58 M 17 62 L 28 61" stroke="#2b2140" strokeWidth="2" strokeLinecap="round" />
              <path d="M 82 56 L 72 58 M 83 62 L 72 61" stroke="#2b2140" strokeWidth="2" strokeLinecap="round" />
            </g>
          </g>
        )}

        {/* CYBER BOT: Visor robótico panorámico continuo */}
        {(hat === 'robot' || hat === 'bot_cpu') && (
          <g>
            {/* Antena superior fija en la cima de la cabeza */}
            <g transform="translate(50, 50)">
              <rect x="-14" y="-34" width="28" height="9" rx="3" fill="#343a40" stroke="#2b2140" strokeWidth="2.5" />
              <line x1="0" y1="-34" x2="0" y2="-45" stroke="#2b2140" strokeWidth="3.5" strokeLinecap="round" />
              <circle cx="0" cy="-47" r="5" fill="#22b8cf" stroke="#2b2140" strokeWidth="2.5" className="animate-pulse" />
            </g>

            {/* Visor y sensores laterales alineados si lleva ropa frontal */}
            <g transform={`translate(50, ${50 + faceY * 0.85})`}>
              <rect x="-35" y="-6" width="6" height="14" rx="2" fill="#868e96" stroke="#2b2140" strokeWidth="2" />
              <circle cx="-32" cy="1" r="1.5" fill="#22b8cf" />
              <rect x="29" y="-6" width="6" height="14" rx="2" fill="#868e96" stroke="#2b2140" strokeWidth="2" />
              <circle cx="32" cy="1" r="1.5" fill="#22b8cf" />

              <rect
                x="-30"
                y="-7"
                width="60"
                height="15"
                rx="5"
                fill="#101a28"
                stroke="#2b2140"
                strokeWidth="3"
              />
              <rect x="-27" y="-4" width="54" height="9" rx="3" fill="#090a0f" />

              <line x1="-24" y1="0.5" x2="24" y2="0.5" stroke="#22b8cf" strokeWidth="2.5" strokeLinecap="round" />
              <rect x="-10" y="-3" width="20" height="7" rx="2" fill="#00f2fe" opacity="0.9" className="animate-pulse" />
              <circle cx="0" cy="0.5" r="2.5" fill="#ffffff" />
            </g>
          </g>
        )}

        {/* DRAGÓN: Cuernos, crestas dorsales y colmillos */}
        {hat === 'dragon' && (
          <g>
            {/* Cuerno Izquierdo */}
            <path
              d="M 26 32 C 16 20 10 6 22 2 C 28 8 30 18 36 26 Z"
              fill="#ffd43b"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* Cuerno Derecho */}
            <path
              d="M 74 32 C 84 20 90 6 78 2 C 72 8 70 18 64 26 Z"
              fill="#ffd43b"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* Crestas superiores */}
            <polygon points="46,24 50,14 54,24" fill="#0ca678" stroke="#2b2140" strokeWidth="2" />
            <polygon points="47,15 50,7 53,15" fill="#0ca678" stroke="#2b2140" strokeWidth="2" />
            {/* Colmillos sincronizados con la boca */}
            <g transform={`translate(0, ${faceY})`}>
              <polygon points="42,65 45,71 47,65" fill="#ffffff" stroke="#2b2140" strokeWidth="1.5" />
              <polygon points="53,65 55,71 58,65" fill="#ffffff" stroke="#2b2140" strokeWidth="1.5" />
            </g>
          </g>
        )}

        {/* NINJA: Cinta y máscara ajustadas al rostro y silueta */}
        {hat === 'ninja' && (
          <g>
            {/* Colas de la cinta */}
            <g transform={`translate(0, ${faceY * 0.65})`}>
              <path d="M 20 40 Q 6 36 2 48 Q 12 44 22 46 Z" fill="#212529" stroke="#2b2140" strokeWidth="3" />
              <path d="M 18 44 Q 4 48 0 60 Q 10 52 20 48 Z" fill="#343a40" stroke="#2b2140" strokeWidth="2.5" />
            </g>

            {/* Cinta frontal recortada a la curvatura de la frente */}
            <g clipPath={`url(#${headWrapClipId})`} transform={`translate(0, ${faceY * 0.65})`}>
              <rect x="18" y="32" width="64" height="12.5" rx="4" fill="#212529" stroke="#2b2140" strokeWidth="3" />
              <rect x="38" y="34" width="24" height="8" rx="2" fill="#ced4da" stroke="#2b2140" strokeWidth="2" />
              <circle cx="42" cy="38" r="1.2" fill="#2b2140" />
              <circle cx="58" cy="38" r="1.2" fill="#2b2140" />
              <path
                d="M 50 35 L 51.5 37.5 L 54 37.5 L 52 39 L 53 41.5 L 50 40 L 47 41.5 L 48 39 L 46 37.5 L 48.5 37.5 Z"
                fill="#ffd43b"
              />
            </g>

            {/* Máscara inferior recortada dentro de la cara para dejar espacio a la ropa */}
            <g clipPath={`url(#${bodyClipId})`}>
              <g transform={`translate(0, ${faceY})`}>
                <path
                  d="M 20 57 Q 50 62 80 57 L 78 72 Q 50 78 22 72 Z"
                  fill="#212529"
                  stroke="#2b2140"
                  strokeWidth="2.8"
                  strokeLinejoin="round"
                />
                <path d="M 34 65 Q 50 69 66 65" stroke="#343a40" strokeWidth="2" fill="none" />
              </g>
            </g>
          </g>
        )}

        {/* GORRO NAVIDEÑO */}
        {hat === 'navidad' && (
          <g transform="translate(50, 24)">
            <path
              d="M -22 0 Q -10 -28 16 -24 Q 28 -20 28 -4 L 20 0 Z"
              fill="#e03131"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <rect x="-24" y="-3" width="48" height="9" rx="4.5" fill="#ffffff" stroke="#2b2140" strokeWidth="3" />
            <circle cx="28" cy="-2" r="7" fill="#ffffff" stroke="#2b2140" strokeWidth="3" />
          </g>
        )}

        {/* SOMBRERO DE GRANJERO */}
        {hat === 'granjero' && (
          <g transform="translate(50, 25)">
            <path d="M -16 0 L -12 -18 Q 0 -22 12 -18 L 16 0 Z" fill="#ffd43b" stroke="#2b2140" strokeWidth="3" />
            <path d="M -13 -6 Q 0 -9 13 -6" stroke="#c92a2a" strokeWidth="3" fill="none" />
            <ellipse cx="0" cy="1" rx="29" ry="8" fill="#fcc419" stroke="#2b2140" strokeWidth="3.5" />
            <path d="M -22 1 Q 0 -3 22 1" stroke="#f08c00" strokeWidth="1.8" fill="none" />
          </g>
        )}

        {/* CASCO VIKINGO */}
        {hat === 'vikingo' && (
          <g transform="translate(50, 24)">
            <path d="M -18 -4 C -28 -12 -34 -26 -24 -32 C -20 -24 -14 -16 -10 -8 Z" fill="#fff9db" stroke="#2b2140" strokeWidth="3" />
            <path d="M 18 -4 C 28 -12 34 -26 24 -32 C 20 -24 14 -16 10 -8 Z" fill="#fff9db" stroke="#2b2140" strokeWidth="3" />
            <path d="M -20 2 Q 0 -24 20 2 Z" fill="#868e96" stroke="#2b2140" strokeWidth="3.5" />
            <rect x="-22" y="0" width="44" height="6" rx="2" fill="#adb5bd" stroke="#2b2140" strokeWidth="3" />
            <circle cx="-12" cy="3" r="1.5" fill="#343a40" />
            <circle cx="0" cy="3" r="1.5" fill="#343a40" />
            <circle cx="12" cy="3" r="1.5" fill="#343a40" />
          </g>
        )}

        {/* CHISTERA / SOMBRERO DE COPA */}
        {hat === 'copa' && (
          <g transform="translate(50, 23)">
            <path d="M -15 2 L -13 -26 L 13 -26 L 15 2 Z" fill="#212529" stroke="#2b2140" strokeWidth="3.5" />
            <rect x="-14" y="-7" width="28" height="7" fill="#c92a2a" stroke="#2b2140" strokeWidth="1.5" />
            <ellipse cx="0" cy="3" rx="26" ry="6" fill="#343a40" stroke="#2b2140" strokeWidth="3.5" />
          </g>
        )}

        {/* GORRA DEPORTIVA */}
        {hat === 'gorra' && (
          <g transform="translate(50, 24)">
            <path d="M -19 2 Q 0 -18 19 2 Z" fill="#1971c2" stroke="#2b2140" strokeWidth="3.5" />
            <circle cx="0" cy="-16" r="2.5" fill="#ffd43b" stroke="#2b2140" strokeWidth="1.5" />
            <path d="M -6 2 Q 18 2 28 8 Q 16 10 -6 3 Z" fill="#1864ab" stroke="#2b2140" strokeWidth="3" strokeLinejoin="round" />
          </g>
        )}

        {/* BOINA DE ARTISTA */}
        {hat === 'boina' && (
          <g transform="translate(50, 24)">
            <ellipse cx="2" cy="-4" rx="25" ry="9" transform="rotate(-8)" fill="#ae3ec9" stroke="#2b2140" strokeWidth="3.5" />
            <line x1="2" y1="-13" x2="2" y2="-17" stroke="#2b2140" strokeWidth="3" strokeLinecap="round" />
            <path d="M -16 2 Q 0 4 16 0" stroke="#862e9c" strokeWidth="2.5" fill="none" />
          </g>
        )}

        {/* CASCO ESPACIAL */}
        {hat === 'espacial' && (
          <g>
            {/* Anillo de sellado metálico en la base de la burbuja */}
            <ellipse
              cx="50"
              cy={usaRopaFrontal ? 76 : 74}
              rx={usaRopaFrontal ? 24.5 : 27}
              ry="6.5"
              fill="#ced4da"
              stroke="#2b2140"
              strokeWidth="3"
            />
            <ellipse
              cx="50"
              cy={usaRopaFrontal ? 76 : 74}
              rx={usaRopaFrontal ? 19.5 : 22}
              ry="3.8"
              fill="#868e96"
            />
            <circle cx={usaRopaFrontal ? 36 : 34} cy={usaRopaFrontal ? 76 : 74} r="1.5" fill="#343a40" />
            <circle cx={usaRopaFrontal ? 64 : 66} cy={usaRopaFrontal ? 76 : 74} r="1.5" fill="#343a40" />
            {/* Burbuja esférica transparente */}
            <circle
              cx="50"
              cy="50"
              r="34"
              fill="#3bc9db"
              fillOpacity="0.22"
              stroke="#2b2140"
              strokeWidth="3.5"
            />
            <path
              d="M 28 32 A 30 30 0 0 1 68 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="3.5"
              strokeLinecap="round"
              opacity="0.85"
            />
            <path
              d="M 25 42 A 28 28 0 0 1 34 30"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.75"
            />
            <circle cx="30" cy="40" r="2" fill="#ffffff" opacity="0.8" />
            <path d="M 78 40 L 88 34" stroke="#2b2140" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="89" cy="33" r="3" fill="#ff6b6b" stroke="#2b2140" strokeWidth="1.5" className="animate-pulse" />
          </g>
        )}
      </svg>
    </div>
  );
};
