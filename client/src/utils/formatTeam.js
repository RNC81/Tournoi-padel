/**
 * formatTeamName(player1, player2)
 *
 * Formate l'affichage d'une équipe : "Prénom1 I. / Prénom2 I."
 * où I. = première lettre du nom de famille + point.
 *
 * Ex : player1="Reyhan Dinmamod", player2="Ali Jawad"
 *   → "Reyhan D. / Ali J."
 *
 * Cas particuliers :
 *   - un seul mot → affiché tel quel, sans initiale
 *   - player manquant → remplacé par chaîne vide
 *   - les deux manquants → "—"
 */
export function formatTeamName(player1, player2) {
  const fmt = (p) => {
    if (!p) return '';
    const parts = p.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    const firstName   = parts.slice(0, -1).join(' ');
    const lastInitial = parts[parts.length - 1][0].toUpperCase();
    return `${firstName} ${lastInitial}.`;
  };

  const f1 = fmt(player1);
  const f2 = fmt(player2);

  if (!f1 && !f2) return '—';
  if (!f1 || !f2) return f1 || f2;
  return `${f1} / ${f2}`;
}
