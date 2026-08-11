import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {LangProvider} from './i18n.tsx';
import CertExportTest from './CertExportTest.tsx';

const isCertTest = new URLSearchParams(window.location.search).has('certtest');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LangProvider>
      {isCertTest ? <CertExportTest /> : <App />}
    </LangProvider>
  </StrictMode>,
);
