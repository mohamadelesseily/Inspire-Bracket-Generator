export const ScoreStepper = ({
  value,
  onChange,
  disabled = false
}: {
  value: number;
  onChange: (val: number) => void;
  disabled?: boolean;
}) => {
  return (
    <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-md p-1">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={disabled}
        className="w-6 h-6 flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-accent-white transition-colors disabled:opacity-30"
      >
        -
      </button>
      <span className="w-6 text-center font-bold text-primary">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        disabled={disabled}
        className="w-6 h-6 flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-accent-white transition-colors disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
};
