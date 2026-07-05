// Keystroke-script notation, shared by the solve tests (par proofs) and the
// title-screen attract mode. Tokens are separated by spaces; each token is a
// sequence of single-char keys, except <e> = Escape, <C-u>/<C-d> = control
// chords, and a trailing <cr> = Enter (search: "/bug<cr>").
// Example: "10l fa <C-u> /bug<cr> n"
export function expand(s: string): string[] {
  const out: string[] = [];
  for (const tok of s.trim().split(/\s+/)) {
    if (tok === '<e>') out.push('Escape');
    else if (tok === '<C-u>' || tok === '<C-d>') out.push(tok);
    else if (tok.endsWith('<cr>')) { out.push(...tok.slice(0, -4).split('')); out.push('Enter'); }
    else out.push(...tok.split(''));
  }
  return out;
}
