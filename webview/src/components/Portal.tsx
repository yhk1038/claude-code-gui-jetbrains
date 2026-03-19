import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export function Portal(props: Props) {
  const { children } = props;
  return createPortal(children, document.body);
}
