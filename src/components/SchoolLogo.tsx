import React from 'react';
import logoPng from '../assets/logo.png';

interface SchoolLogoProps {
  className?: string;
  size?: number;
}

// Renders the official school logo (PNG). Keeps the same API (className / size)
// as before so every existing call site continues to work unchanged.
export const SchoolLogo: React.FC<SchoolLogoProps> = ({ className = 'w-10 h-10', size }) => {
  return (
    <img
      src={logoPng}
      alt="សាលាសហគមន៍ច្បារច្រុះ Logo"
      className={`${className} object-contain`}
      style={size ? { width: size, height: size } : undefined}
    />
  );
};

export default SchoolLogo;
