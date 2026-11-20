import React, { useEffect, useRef } from 'react';

const VLIBRAS_SCRIPT_ID = 'vlibras-plugin-script';
const VLIBRAS_SCRIPT_SRC = 'https://vlibras.gov.br/app/vlibras-plugin.js';
const VLIBRAS_APP_URL = 'https://vlibras.gov.br/app';

interface VLibrasWidgetOptions {
  rootPath?: string;
  position?: 'L' | 'R' | 'T' | 'B' | 'TL' | 'TR' | 'BL' | 'BR';
  opacity?: number;
}

declare global {
  interface Window {
    VLibras?: {
      Widget: new (urlOrOptions?: string | VLibrasWidgetOptions) => unknown;
    };
    VLibrasWidget?: {
      open?: () => void;
      close?: () => void;
      toggle?: () => void;
    };
    __campusIaVlibrasInitialized?: boolean;
  }
}

export const VLibrasWidget: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    // Configura os atributos oficiais exigidos pelo contêiner VLibras sem conflitos de JSX/TS
    const rootEl = containerRef.current;
    if (rootEl) {
      rootEl.setAttribute('vw', '');
      rootEl.classList.add('enabled');

      const accessBtn = rootEl.querySelector('[data-vw-access-button]');
      if (accessBtn) {
        accessBtn.setAttribute('vw-access-button', '');
        accessBtn.classList.add('active');
      }

      const pluginWrapper = rootEl.querySelector('[data-vw-plugin-wrapper]');
      if (pluginWrapper) {
        pluginWrapper.setAttribute('vw-plugin-wrapper', '');
      }
    }

    const initializeWidget = () => {
      try {
        if (
          window.__campusIaVlibrasInitialized ||
          document.getElementById('vlibras-access-wrapper')
        ) {
          window.__campusIaVlibrasInitialized = true;
          return;
        }

        if (window.VLibras && typeof window.VLibras.Widget === 'function') {
          window.__campusIaVlibrasInitialized = true;
          new window.VLibras.Widget(VLIBRAS_APP_URL);
        }
      } catch (err) {
        window.__campusIaVlibrasInitialized = false;
        console.warn('VLibras indisponível no momento:', err);
      }
    };

    // Garante carregamento único do script oficial mesmo sob React StrictMode
    const existingScript =
      (document.getElementById(VLIBRAS_SCRIPT_ID) as HTMLScriptElement | null) ||
      (document.querySelector(`script[src*="vlibras-plugin.js"]`) as HTMLScriptElement | null);

    if (existingScript) {
      if (window.VLibras && typeof window.VLibras.Widget === 'function') {
        initializeWidget();
      } else {
        existingScript.addEventListener('load', initializeWidget, { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.id = VLIBRAS_SCRIPT_ID;
    script.src = VLIBRAS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;

    const handleLoad = () => {
      initializeWidget();
    };

    const handleError = () => {
      console.warn('Não foi possível carregar o script oficial do VLibras. A plataforma segue operando normalmente.');
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    document.body.appendChild(script);

    return () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <div ref={containerRef} aria-label="Acessibilidade em Libras - VLibras">
      <div data-vw-access-button="" />
      <div data-vw-plugin-wrapper="">
        <div className="vw-plugin-top-wrapper" />
      </div>
    </div>
  );
};
