import React from 'react';
import { IconType } from 'react-icons';

interface IconProps {
  icon: IconType;
  size?: number;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ 
  icon: IconComponent, 
  size = 18, 
  className = '' 
}) => {
  return (
    <span className={className}>
      <IconComponent size={size} />
    </span>
  );
};