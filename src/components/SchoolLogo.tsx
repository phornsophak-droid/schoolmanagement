import React from 'react';

interface SchoolLogoProps {
  className?: string;
  size?: number;
}

export const SchoolLogo: React.FC<SchoolLogoProps> = ({ className = 'w-10 h-10', size }) => {
  return (
    <svg 
      viewBox="0 0 200 200" 
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <defs>
        {/* Gradients */}
        <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
        <linearGradient id="sunGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
        <linearGradient id="pageGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F8FAFC" />
          <stop offset="45%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F1F5F9" />
        </linearGradient>

        {/* Text Paths */}
        {/* Top Text Path (clockwise semicircle) */}
        <path id="logoTopArc" d="M 30,100 A 70,70 0 0,1 170,100" fill="none" />
        {/* Bottom Text Path (clockwise bottom semicircle) */}
        <path id="logoBottomArc" d="M 170,100 A 70,70 0 0,1 30,100" fill="none" />
      </defs>

      {/* Main Outer Circle */}
      <circle cx="100" cy="100" r="95" fill="url(#blueGradient)" stroke="url(#goldGradient)" strokeWidth="4" />
      
      {/* Decorative Gold Inner Border */}
      <circle cx="100" cy="100" r="88" fill="none" stroke="#FBBF24" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="100" cy="100" r="82" fill="none" stroke="#FEF08A" strokeWidth="1" />

      {/* Inner Emblem circle */}
      <circle cx="100" cy="100" r="62" fill="#FFFFFF" stroke="url(#goldGradient)" strokeWidth="3" />
      <circle cx="100" cy="100" r="59" fill="none" stroke="#FEF08A" strokeWidth="1" />

      {/* Text Top: Khmer Script */}
      <text fill="#FFFFFF" fontSize="12" fontWeight="900" letterSpacing="0.2px">
        <textPath href="#logoTopArc" startOffset="50%" textAnchor="middle">
          សាលាសហគមន៍ច្បារច្រុះ
        </textPath>
      </text>

      {/* Text Bottom: English Title */}
      <text fill="#FEF08A" fontSize="7.5" fontWeight="800" letterSpacing="0.4px">
        <textPath href="#logoBottomArc" startOffset="50%" textAnchor="middle">
          CHBAR CHROS COMMUNITY SCHOOL
        </textPath>
      </text>

      {/* Star decorations between texts */}
      <g fill="#F59E0B">
        {/* Left Star */}
        <polygon points="26,100 28,103 31,100 28,97" />
        <circle cx="28" cy="100" r="1" fill="#FFFFFF" />
        {/* Right Star */}
        <polygon points="174,100 172,103 169,100 172,97" />
        <circle cx="172" cy="100" r="1" fill="#FFFFFF" />
      </g>

      {/* Center Artwork - Sun Rays */}
      <g opacity="0.85">
        <line x1="100" y1="100" x2="65" y2="65" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" />
        <line x1="100" y1="100" x2="80" y2="55" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" />
        <line x1="100" y1="100" x2="100" y2="50" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="100" y1="100" x2="120" y2="55" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" />
        <line x1="100" y1="100" x2="135" y2="65" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" />
        
        <line x1="100" y1="100" x2="52" y2="80" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="100" y1="100" x2="148" y2="80" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* Rising Sun Body */}
      <circle cx="100" cy="100" r="28" fill="url(#sunGradient)" />

      {/* Opened Book */}
      {/* Cover backing */}
      <path 
        d="M 100,116 C 85,110 68,114 58,119 L 58,104 C 68,99 85,95 100,101 C 115,95 132,99 142,104 L 142,119 C 132,114 115,110 100,116 Z" 
        fill="#1E3A8A" 
      />
      {/* Pages */}
      <path 
        d="M 100,113 C 85,107 68,111 60,116 L 60,101 C 68,96 85,92 100,98 C 115,92 132,96 140,101 L 140,116 C 132,111 115,107 100,113 Z" 
        fill="url(#pageGradient)" 
        stroke="#1E40AF" 
        strokeWidth="1" 
      />
      {/* Spine lines */}
      <line x1="100" y1="99" x2="100" y2="113" stroke="#1E40AF" strokeWidth="1.5" />

      {/* CAMKIDS Hearts & Script below book */}
      <g transform="translate(0, 119)">
        {/* Heart Shapes */}
        {/* Heart 1: C */}
        <g transform="translate(56, 12) scale(0.65)">
          <path d="M12,5 C8,-1 0,0 0,7 C0,13 12,21 12,21 C12,21 24,13 24,7 C24,0 16,-1 12,5 Z" fill="#EF4444" />
          <text x="12" y="12" fill="#FFFFFF" fontSize="10" fontWeight="950" textAnchor="middle">C</text>
        </g>
        {/* Heart 2: A */}
        <g transform="translate(68, 14) scale(0.65)">
          <path d="M12,5 C8,-1 0,0 0,7 C0,13 12,21 12,21 C12,21 24,13 24,7 C24,0 16,-1 12,5 Z" fill="#F97316" />
          <text x="12" y="12" fill="#FFFFFF" fontSize="10" fontWeight="950" textAnchor="middle">A</text>
        </g>
        {/* Heart 3: M */}
        <g transform="translate(80, 15) scale(0.65)">
          <path d="M12,5 C8,-1 0,0 0,7 C0,13 12,21 12,21 C12,21 24,13 24,7 C24,0 16,-1 12,5 Z" fill="#D97706" />
          <text x="12" y="11.5" fill="#FFFFFF" fontSize="8" fontWeight="950" textAnchor="middle">M</text>
        </g>
        {/* Heart 4: K */}
        <g transform="translate(92, 15) scale(0.65)">
          <path d="M12,5 C8,-1 0,0 0,7 C0,13 12,21 12,21 C12,21 24,13 24,7 C24,0 16,-1 12,5 Z" fill="#10B981" />
          <text x="12" y="12" fill="#FFFFFF" fontSize="10" fontWeight="950" textAnchor="middle">K</text>
        </g>
        {/* Heart 5: I */}
        <g transform="translate(104, 15) scale(0.65)">
          <path d="M12,5 C8,-1 0,0 0,7 C0,13 12,21 12,21 C12,21 24,13 24,7 C24,0 16,-1 12,5 Z" fill="#3B82F6" />
          <text x="12" y="12" fill="#FFFFFF" fontSize="10" fontWeight="950" textAnchor="middle">I</text>
        </g>
        {/* Heart 6: D */}
        <g transform="translate(116, 14) scale(0.65)">
          <path d="M12,5 C8,-1 0,0 0,7 C0,13 12,21 12,21 C12,21 24,13 24,7 C24,0 16,-1 12,5 Z" fill="#6366F1" />
          <text x="12" y="12" fill="#FFFFFF" fontSize="10" fontWeight="950" textAnchor="middle">D</text>
        </g>
        {/* Heart 7: S */}
        <g transform="translate(128, 12) scale(0.65)">
          <path d="M12,5 C8,-1 0,0 0,7 C0,13 12,21 12,21 C12,21 24,13 24,7 C24,0 16,-1 12,5 Z" fill="#8B5CF6" />
          <text x="12" y="12" fill="#FFFFFF" fontSize="10" fontWeight="950" textAnchor="middle">S</text>
        </g>
      </g>
    </svg>
  );
};

export default SchoolLogo;
