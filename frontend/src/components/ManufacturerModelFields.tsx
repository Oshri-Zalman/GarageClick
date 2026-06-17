import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { getManufacturers, getModels } from '../services/catalog';
import { MANUFACTURERS as FALLBACK_MANUFACTURERS } from '../utils/manufacturers';

// Sentinel value for the manufacturer <select> meaning "let me type my own".
const OTHER = '__other__';

interface Props {
  manufacturer: string;
  model: string;
  onManufacturerChange: (value: string) => void;
  onModelChange: (value: string) => void;
  manufacturerError?: string;
  modelError?: string;
  // Unique prefix so multiple instances on a page get distinct ids/datalists.
  idPrefix: string;
  fieldClass: string;
}

// Cascading manufacturer -> model fields backed by the vehicle catalog
// (GET /api/catalog/*). The manufacturer is a <select> populated from the catalog
// (merged with a static fallback so it still works offline / before the fetch
// resolves), plus an "אחר" option that reveals a free-text input. The model is a
// text input with a <datalist> of the selected manufacturer's models, so the user
// gets catalog suggestions while custom values stay possible (the backend accepts
// free text). Keeps Hebrew RTL + amber styling consistent with the forms.
export default function ManufacturerModelFields({
  manufacturer,
  model,
  onManufacturerChange,
  onModelChange,
  manufacturerError,
  modelError,
  idPrefix,
  fieldClass,
}: Props) {
  const [catalogManufacturers, setCatalogManufacturers] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  // True once the user picks "אחר" (or starts with a manufacturer not in the
  // known list — e.g. editing a vehicle saved with a custom make).
  const [otherMode, setOtherMode] = useState(false);

  const datalistId = useId();

  // Load the manufacturer catalog once. On failure we silently keep the static
  // fallback list — the dropdown must never block the form.
  useEffect(() => {
    let active = true;
    getManufacturers()
      .then((list) => {
        if (active) setCatalogManufacturers(list);
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      active = false;
    };
  }, []);

  // The option list: catalog ∪ static fallback ∪ the current value (so an
  // already-saved custom make still shows), sorted and de-duplicated.
  const manufacturerOptions = useMemo(() => {
    const set = new Set<string>([...FALLBACK_MANUFACTURERS, ...catalogManufacturers]);
    if (manufacturer && !otherMode) set.add(manufacturer);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [catalogManufacturers, manufacturer, otherMode]);

  // Load the models for the chosen manufacturer (skip in free-text mode). On
  // failure the datalist is simply empty — the model field stays free text.
  useEffect(() => {
    if (otherMode || !manufacturer) return;
    let active = true;
    getModels(manufacturer)
      .then((list) => {
        if (active) setModels(list);
      })
      .catch(() => {
        if (active) setModels([]);
      });
    return () => {
      active = false;
    };
  }, [manufacturer, otherMode]);

  // Suggestions only apply to a known catalog manufacturer in dropdown mode.
  const modelOptions = otherMode || !manufacturer ? [] : models;

  const handleManufacturerSelect = (value: string) => {
    if (value === OTHER) {
      setOtherMode(true);
      onManufacturerChange('');
    } else {
      setOtherMode(false);
      onManufacturerChange(value);
    }
  };

  return (
    <>
      <Field id={`${idPrefix}-manufacturer`} label="יצרן" error={manufacturerError}>
        <select
          id={`${idPrefix}-manufacturer`}
          value={otherMode ? OTHER : manufacturer}
          onChange={(e) => handleManufacturerSelect(e.target.value)}
          className={fieldClass}
        >
          <option value="">בחר יצרן...</option>
          {manufacturerOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          <option value={OTHER}>אחר</option>
        </select>
      </Field>

      {otherMode && (
        <Field
          id={`${idPrefix}-manufacturer-custom`}
          label="יצרן (הזן ידנית)"
          error={undefined}
        >
          <input
            id={`${idPrefix}-manufacturer-custom`}
            type="text"
            value={manufacturer}
            onChange={(e) => onManufacturerChange(e.target.value)}
            placeholder="שם היצרן"
            className={fieldClass}
          />
        </Field>
      )}

      <Field id={`${idPrefix}-model`} label="דגם" error={modelError}>
        <input
          id={`${idPrefix}-model`}
          type="text"
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          list={datalistId}
          className={fieldClass}
        />
        <datalist id={datalistId}>
          {modelOptions.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </Field>
    </>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-gray-700">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
