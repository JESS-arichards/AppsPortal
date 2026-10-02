import React from 'react';
import { DEFAULT_CORE_VALUE_ICON, isImageIcon } from '../utils/coreValues';

/** Fixed-size, decorative icon slot shown beside each core value on the sign-in page. */
export const CoreValueIcon: React.FC<{ icon?: string | null }> = ({ icon }) => {
  if (isImageIcon(icon)) {
    return (
      <span className="value-bullet value-bullet-image" aria-hidden="true">
        <img src={icon} alt="" />
      </span>
    );
  }
  return (
    <span className={`value-bullet${icon ? ' value-bullet-custom' : ''}`} aria-hidden="true">
      {icon || DEFAULT_CORE_VALUE_ICON}
    </span>
  );
};
