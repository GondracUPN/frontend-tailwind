import React, { useEffect, useState } from 'react';
import { OCR_FIELDS, assignCandidate, candidateTargets, candidateTitle, isFieldApplicable, warningText } from '../utils/snImeiOcr';

const FIELD_ACTION = { serial: 'Usar como serial', imei: 'Usar como IMEI 1', imei2: 'Usar como IMEI 2' };

const validationTone = (candidate) => {
  if (candidate.validation?.status === 'invalid') return 'border-red-200 bg-red-50';
  if (candidate.autofill) return 'border-emerald-200 bg-emerald-50/60';
  return 'border-amber-200 bg-amber-50/60';
};

/** Revisión de candidatos OCR compartida por Inventario y el escáner de Productos.
 * `values` son los valores actuales ({serial, imei, imei2}); `onAssign(field, value)` aplica un cambio ya aceptado.
 * Un valor ya escrito nunca se sustituye sin confirmación explícita. */
export default function OcrCandidateReview({ parsed, values, reglas = null, onAssign, persistenceNote = '' }) {
  const [pending, setPending] = useState(null);
  // Una confirmación pendiente pertenece a la lectura en que se abrió: otra lectura la descarta.
  useEffect(() => { setPending(null); }, [parsed]);
  const candidates = parsed?.candidates || [];
  const conflicts = parsed?.conflicts || [];
  if (!candidates.length && !conflicts.length) return null;

  const use = (field, value) => {
    const { patch, conflict } = assignCandidate(values, field, value);
    if (conflict) setPending(conflict);
    else if (patch) {
      setPending(null);
      onAssign(field, patch[field]);
    }
  };

  const confirmReplace = () => {
    // Si el campo cambió desde que se abrió la confirmación, se vuelve a preguntar con el valor actual.
    const current = String(values?.[pending.field] || '').trim();
    if (current && current !== pending.current && current !== pending.proposed) {
      setPending({ ...pending, current });
      return;
    }
    onAssign(pending.field, pending.proposed);
    setPending(null);
  };

  const imeiHidden = reglas && !isFieldApplicable(reglas, 'imei') && candidates.some((c) => c.kind === 'imei');

  return (
    <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3" aria-label="Revisión de SN / IMEI detectados">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detectados para revisar</div>
      {persistenceNote && <div className="text-xs text-slate-500">{persistenceNote}</div>}
      {conflicts.map((conflict, index) => (
        <div key={`conflict-${index}`} role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {conflict.type === 'same_value_both_slots'
            ? `El mismo número aparece como IMEI 1 e IMEI 2: ${conflict.values.join(', ')}.`
            : conflict.type === 'slot_conflict'
              ? `Se leyeron valores distintos para ${conflict.slot === 'imei2' ? 'IMEI 2' : 'IMEI 1'}: ${conflict.values.join(' / ')}.`
              : `Se leyeron seriales distintos: ${conflict.values.join(' / ')}.`}
          {' '}No se autocompleta: elige el correcto.
        </div>
      ))}
      {imeiHidden && <div className="text-xs text-slate-500">Se detectaron IMEI, pero este modelo no admite IMEI: no se asignan.</div>}
      {pending && (
        <div role="alert" className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          {pending.type === 'duplicate'
            ? `${pending.proposed} ya está en ${OCR_FIELDS[pending.other]}. IMEI 1 e IMEI 2 no pueden ser iguales.`
            : `${OCR_FIELDS[pending.field]} ya tiene ${pending.current}. ¿Reemplazar por ${pending.proposed}?`}
          <div className="mt-2 flex gap-2">
            {pending.type === 'replace' && (
              <button type="button" onClick={confirmReplace} className="rounded bg-blue-700 px-2 py-1 font-semibold text-white hover:bg-blue-800">Reemplazar</button>
            )}
            <button type="button" onClick={() => setPending(null)} className="rounded border border-blue-300 bg-white px-2 py-1 font-semibold text-blue-800 hover:bg-blue-100">Mantener actual</button>
          </div>
        </div>
      )}
      <ul className="space-y-1.5">
        {candidates.map((candidate) => {
          const targets = candidate.kind === 'imei' && reglas && !isFieldApplicable(reglas, 'imei') ? [] : candidateTargets(candidate, reglas);
          return (
            <li key={candidate.id} className={`rounded-lg border p-2 ${validationTone(candidate)}`}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[11px] font-semibold text-slate-600">{candidateTitle(candidate)}</span>
                <span className="mr-auto break-all font-mono text-sm font-semibold text-slate-900">{candidate.value}</span>
                <span className="text-[11px] text-slate-500" title={`Confianza (${candidate.confidenceSource})`}>{Math.round(candidate.confidence * 100)}%</span>
              </div>
              {(candidate.validation?.message || candidate.warnings.length > 0 || candidate.rawValue !== candidate.value) && (
                <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                  {candidate.validation?.message && <span className="text-red-700">{candidate.validation.message}</span>}
                  {candidate.rawValue !== candidate.value && <span className="text-slate-500">Leído: <span className="font-mono">{candidate.rawValue}</span></span>}
                  {candidate.warnings.map((warning) => <span key={warning} className="rounded bg-white/80 px-1.5 py-0.5 text-slate-600 ring-1 ring-slate-200">{warningText(warning)}</span>)}
                </div>
              )}
              {targets.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {targets.map((field) => {
                    const current = String(values?.[field] || '').trim();
                    const applied = current === candidate.value;
                    return (
                      <button
                        key={field}
                        type="button"
                        onClick={() => use(field, candidate.value)}
                        disabled={applied}
                        className="rounded bg-white px-2 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50 disabled:cursor-default disabled:text-emerald-700 disabled:ring-emerald-200"
                      >
                        {applied ? `En ${OCR_FIELDS[field]}` : FIELD_ACTION[field]}
                      </button>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
