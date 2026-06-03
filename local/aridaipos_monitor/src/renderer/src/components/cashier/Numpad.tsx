'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { T } from '@/lib/theme';

// Адаптивная сцена (без scale-трансформации) — координаты 1:1 с экраном.
function frameScale() {
  return 1;
}
const vw = () => (typeof window === 'undefined' ? 1366 : window.innerWidth);
const vh = () => (typeof window === 'undefined' ? 768 : window.innerHeight);

// Suzuvchi raqamli klaviatura. Fokusdagi input/textarea ga yozadi.
// Header tugmasi orqali ochiladi; markazda; tepa chizig'idan ko'chiriladi.
export function Numpad({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      if (el.tagName === 'TEXTAREA') {
        fieldRef.current = el as HTMLTextAreaElement;
        return;
      }
      if (el.tagName === 'INPUT') {
        const t = ((el as HTMLInputElement).getAttribute('type') || 'text').toLowerCase();
        if (['text', 'tel', 'number', 'search', 'password', 'email', ''].includes(t)) {
          fieldRef.current = el as HTMLInputElement;
        }
      }
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  const apply = useCallback((key: string) => {
    const el = fieldRef.current;
    if (!el || !el.isConnected) return;
    const isNumber = el.tagName === 'INPUT' && ((el as HTMLInputElement).type || '').toLowerCase() === 'number';
    const v = el.value != null ? String(el.value) : '';
    let start = isNumber ? v.length : el.selectionStart ?? v.length;
    let end = isNumber ? v.length : el.selectionEnd ?? v.length;
    let next = v;
    let caret = start;
    if (key === 'clear') {
      next = '';
      caret = 0;
    } else if (key === 'back') {
      if (start !== end) {
        next = v.slice(0, start) + v.slice(end);
        caret = start;
      } else if (start > 0) {
        next = v.slice(0, start - 1) + v.slice(start);
        caret = start - 1;
      }
    } else {
      next = v.slice(0, start) + key + v.slice(end);
      caret = start + key.length;
    }
    const proto =
      el.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter?.call(el, next);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    try {
      el.focus();
      if (!isNumber) el.setSelectionRange(caret, caret);
    } catch {
      /* number input */
    }
  }, []);

  const onDragStart = (e: React.MouseEvent) => {
    const box = boxRef.current;
    if (!box) return;
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    const startPos = pos || { x: (vw() - w) / 2, y: (vh() - h) / 2 };
    const sx = e.clientX;
    const sy = e.clientY;
    const s = frameScale() || 1;
    const onMove = (ev: MouseEvent) => {
      let x = startPos.x + (ev.clientX - sx) / s;
      let y = startPos.y + (ev.clientY - sy) / s;
      x = Math.max(0, Math.min(x, vw() - w));
      y = Math.max(0, Math.min(y, vh() - h));
      setPos({ x, y });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    e.preventDefault();
  };

  if (!open) return null;

  const boxStyle: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };

  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '00', '0', 'back'];
  const noBlur = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div
      ref={boxRef}
      style={{
        position: 'fixed',
        zIndex: 99999,
        width: 320,
        background: T.surface,
        border: `2px solid ${T.borderStrong}`,
        boxShadow: '0 12px 40px rgba(0,0,0,0.30)',
        userSelect: 'none',
        ...boxStyle,
      }}
    >
      <div
        onMouseDown={onDragStart}
        style={{
          height: 44,
          background: T.borderStrong,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px 0 14px',
          cursor: 'move',
          fontFamily: T.font,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.5 }}>⠿ Клавиатура</span>
        <button
          onMouseDown={noBlur}
          onClick={onClose}
          style={{
            width: 32,
            height: 32,
            background: 'transparent',
            color: '#fff',
            border: 'none',
            fontSize: 20,
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ padding: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {keys.map((k) => {
            const isBack = k === 'back';
            return (
              <button
                key={k}
                onMouseDown={noBlur}
                onClick={() => apply(isBack ? 'back' : k)}
                style={{
                  height: 64,
                  background: isBack ? T.panelStrong : T.panel,
                  color: T.text,
                  border: `2px solid ${T.border}`,
                  fontFamily: T.font,
                  fontSize: 24,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {isBack ? '⌫' : k}
              </button>
            );
          })}
        </div>
        <button
          onMouseDown={noBlur}
          onClick={() => apply('clear')}
          style={{
            width: '100%',
            height: 52,
            marginTop: 8,
            background: T.cancelledBg,
            color: T.cancelled,
            border: 'none',
            fontFamily: T.font,
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 0.4,
            cursor: 'pointer',
          }}
        >
          Очистить
        </button>
      </div>
    </div>
  );
}
