/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HatType } from '../types/murosLocos';

interface CartoonCharacterProps {
  color: string;
  hat: HatType;
  size?: number;
  isActive?: boolean;
  isDancing?: boolean;
  className?: string;
  showShadow?: boolean;
}

export const CartoonCharacter: React.FC<CartoonCharacterProps> = ({
  color,
  hat,
  size = 56,
  isActive = false,
  isDancing = false,
  className = '',
  showShadow = true,
}) => {
  // SVG proportions based on 100x100 viewBox
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        className={`w-full h-full overflow-visible transition-transform duration-300 ${
          isDancing
            ? 'animate-bounce'
            : isActive
            ? 'animate-pulse scale-105'
            : ''
        }`}
      >
        <defs>
          <radialGradient id={`bodyGrad-${color.replace('#', '')}`} cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="60%" stopColor={color} />
            <stop offset="100%" stopColor="#1e1830" stopOpacity="0.3" />
          </radialGradient>
          <filter id="hardShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="0" floodColor="#2b2140" floodOpacity="0.8" />
          </filter>
        </defs>

        {/* Ground shadow */}
        {showShadow && (
          <ellipse
            cx="50"
            cy="92"
            rx="28"
            ry="7"
            fill="#2b2140"
            opacity="0.25"
          />
        )}

        {/* Feet */}
        <ellipse
          cx="36"
          cy="87"
          rx="10"
          ry="6"
          fill="#ffd43b"
          stroke="#2b2140"
          strokeWidth="3.5"
        />
        <ellipse
          cx="64"
          cy="87"
          rx="10"
          ry="6"
          fill="#ffd43b"
          stroke="#2b2140"
          strokeWidth="3.5"
        />

        {/* Main Body */}
        <circle
          cx="50"
          cy="54"
          r="32"
          fill={color}
          stroke="#2b2140"
          strokeWidth="4"
        />
        {/* Soft highlight arc on top left */}
        <path
          d="M 28 42 A 25 25 0 0 1 54 26"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* Blush cheeks */}
        <circle cx="29" cy="62" r="5" fill="#ff8787" opacity="0.6" />
        <circle cx="71" cy="62" r="5" fill="#ff8787" opacity="0.6" />

        {/* Eyes (cartoon big whites + glossy pupils) */}
        <g className="animate-[blink_4s_ease-in-out_infinite]">
          {/* Left eye */}
          <ellipse
            cx="39"
            cy="50"
            rx="7"
            ry="9"
            fill="#ffffff"
            stroke="#2b2140"
            strokeWidth="3"
          />
          <circle cx="41" cy="50" r="4.5" fill="#2b2140" />
          <circle cx="42.5" cy="48" r="1.8" fill="#ffffff" />

          {/* Right eye */}
          <ellipse
            cx="61"
            cy="50"
            rx="7"
            ry="9"
            fill="#ffffff"
            stroke="#2b2140"
            strokeWidth="3"
          />
          <circle cx="63" cy="50" r="4.5" fill="#2b2140" />
          <circle cx="64.5" cy="48" r="1.8" fill="#ffffff" />
        </g>

        {/* Cheerful Smile */}
        <path
          d="M 43 64 Q 50 72 57 64"
          fill="none"
          stroke="#2b2140"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Hat Customization */}
        {hat === 'corona' && (
          <g transform="translate(50, 22)">
            {/* Golden Crown */}
            <path
              d="M -22 0 L -16 -18 L -6 -6 L 0 -22 L 6 -6 L 16 -18 L 22 0 Z"
              fill="#ffd43b"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* Crown gems */}
            <circle cx="0" cy="-6" r="3" fill="#ff6b6b" stroke="#2b2140" strokeWidth="1.5" />
            <circle cx="-11" cy="-4" r="2.5" fill="#4dabf7" stroke="#2b2140" strokeWidth="1.5" />
            <circle cx="11" cy="-4" r="2.5" fill="#51cf66" stroke="#2b2140" strokeWidth="1.5" />
          </g>
        )}

        {hat === 'pompon' && (
          <g transform="translate(50, 23)">
            {/* Beanie with stripes */}
            <path
              d="M -20 2 C -20 -18 20 -18 20 2 Z"
              fill="#339af0"
              stroke="#2b2140"
              strokeWidth="3.5"
            />
            <path
              d="M -16 -6 Q 0 -12 16 -6"
              fill="none"
              stroke="#ffffff"
              strokeWidth="3"
            />
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
            {/* Pompom */}
            <circle
              cx="0"
              cy="-18"
              r="7"
              fill="#ffffff"
              stroke="#2b2140"
              strokeWidth="3"
            />
          </g>
        )}

        {hat === 'antena' && (
          <g transform="translate(50, 22)">
            {/* Metallic antenna base */}
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
            {/* Stem */}
            <path
              d="M 0 -2 L 0 -18"
              fill="none"
              stroke="#2b2140"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Glowing red orb */}
            <circle
              cx="0"
              cy="-22"
              r="6.5"
              fill="#ff6b6b"
              stroke="#2b2140"
              strokeWidth="3"
            />
            <circle cx="2" cy="-24" r="2" fill="#ffffff" />
          </g>
        )}

        {hat === 'brote' && (
          <g transform="translate(50, 22)">
            {/* Sprout stem */}
            <path
              d="M 0 0 Q 3 -12 0 -16"
              fill="none"
              stroke="#2b2140"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Left leaf */}
            <path
              d="M 0 -14 C -12 -16 -12 -6 0 -10 Z"
              fill="#69db7c"
              stroke="#2b2140"
              strokeWidth="3"
            />
            {/* Right leaf */}
            <path
              d="M 0 -15 C 14 -18 14 -6 0 -11 Z"
              fill="#8ce99a"
              stroke="#2b2140"
              strokeWidth="3"
            />
          </g>
        )}

        {hat === 'mago' && (
          <g transform="translate(50, 24)">
            {/* Wizard Hat Brim */}
            <ellipse cx="0" cy="2" rx="24" ry="6" fill="#5f3dc4" stroke="#2b2140" strokeWidth="3.5" />
            {/* Wizard Cone */}
            <path
              d="M -16 1 Q -8 -22 14 -30 Q 8 -16 16 1 Z"
              fill="#7950f2"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* Hat Band */}
            <path d="M -15 0 Q 0 -4 15 0" fill="none" stroke="#ffd43b" strokeWidth="3" />
            {/* Gold Star at Tip */}
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
            {/* Left Cat Ear */}
            <path
              d="M 24 35 L 20 12 L 39 25 Z"
              fill="#f06595"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <path
              d="M 25 31 L 22 17 L 35 25 Z"
              fill="#ffdeeb"
            />
            {/* Right Cat Ear */}
            <path
              d="M 76 35 L 80 12 L 61 25 Z"
              fill="#f06595"
              stroke="#2b2140"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <path
              d="M 75 31 L 78 17 L 65 25 Z"
              fill="#ffdeeb"
            />
            {/* Whiskers */}
            <path d="M 16 57 L 27 58 M 15 62 L 27 61" stroke="#2b2140" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 84 57 L 73 58 M 85 62 L 73 61" stroke="#2b2140" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        )}
      </svg>
    </div>
  );
};
