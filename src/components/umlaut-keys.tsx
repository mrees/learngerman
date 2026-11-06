const KEYS = ["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü"] as const;

export function UmlautKeys({ onInsert }: { onInsert: (char: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="German letters">
      {KEYS.map((char) => (
        <button
          key={char}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onInsert(char)}
          className="min-h-11 min-w-11 rounded-lg border border-line bg-surface px-2 text-base text-ink hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {char}
        </button>
      ))}
    </div>
  );
}

export function insertAtCursor(
  element: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
  char: string,
  setValue: (next: string) => void,
) {
  if (!element) {
    setValue(value + char);
    return;
  }
  const start = element.selectionStart ?? value.length;
  const end = element.selectionEnd ?? value.length;
  const next = value.slice(0, start) + char + value.slice(end);
  setValue(next);
  requestAnimationFrame(() => {
    element.focus();
    const pos = start + char.length;
    element.setSelectionRange(pos, pos);
  });
}
