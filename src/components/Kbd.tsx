/** Keyboard hint, shown only on computers (mouse or trackpad), never on phones. */
export default function Kbd({ k, light }: { k: string; light?: boolean }) {
  return <kbd className={`hidden rounded-md px-1.5 py-0.5 font-sans text-xs font-bold pointer-fine:inline ${light ? 'bg-white/20' : 'bg-black/5 dark:bg-white/10'}`}>{k}</kbd>
}
