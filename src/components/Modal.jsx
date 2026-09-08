import React from 'react';

export default function Modal({ size, title, onClose, children, footer }) {
  return (
    <div className="overlay show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'modal' + (size ? ' ' + size : '')}>
        <div className="mhd"><span className="mtitle">{title}</span><button className="mclose" onClick={onClose}>×</button></div>
        <div className="mbody">{children}</div>
        {footer && <div className="mfoot">{footer}</div>}
      </div>
    </div>
  );
}
