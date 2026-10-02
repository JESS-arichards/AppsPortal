import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

let openModalCount = 0;

/**
 * Renders modal dialogs directly under <body> so they are not trapped inside
 * page stacking contexts or containing blocks (e.g. glass cards using
 * backdrop-filter), and locks background page scrolling while open so touch
 * scrolling on mobile is applied to the dialog rather than the page behind it.
 */
export const ModalPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    openModalCount += 1;
    document.documentElement.classList.add('modal-open');
    return () => {
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) {
        document.documentElement.classList.remove('modal-open');
      }
    };
  }, []);

  return createPortal(children, document.body);
};
