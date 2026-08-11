import React, { useEffect, useState } from 'react';
import MeritCertificate from './components/MeritCertificate';
import { PRINCIPAL_SIG_KEY } from './components/PrincipalSignature';
import { teacherSigKey } from './components/TeacherSignature';
import type { StudentScore } from './types';

function sig(): string {
  const c = document.createElement('canvas'); c.width = 300; c.height = 120;
  const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 300, 120);
  ctx.strokeStyle = '#1e3a8a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(20, 90);
  ctx.bezierCurveTo(60, 10, 100, 110, 150, 60); ctx.bezierCurveTo(190, 20, 230, 100, 285, 40); ctx.stroke();
  return c.toDataURL('image/png');
}
const mockStudent: StudentScore = { name: 'ទ្រី រតនា', grade: 'ថ្នាក់ទី៦', gender: 'ស្រី', month: 'សីហា', overallAvg: 6.9, dob: '05/04/2015' } as any;

export default function CertExportTest() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const s = sig(); localStorage.setItem(PRINCIPAL_SIG_KEY, s); localStorage.setItem(teacherSigKey('ថ្នាក់ទី៦'), s); } catch { /* ignore */ }
    setReady(true);
  }, []);
  if (!ready) return null;
  return <MeritCertificate student={mockStudent} students={[mockStudent]} scoreOverride={6.9} certType="completion" onClose={() => {}} />;
}
