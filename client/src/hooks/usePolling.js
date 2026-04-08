import { useEffect, useRef } from 'react';

/**
 * Hook de polling : appelle une fonction à intervalles réguliers.
 * Utilisé pour rafraîchir les scores toutes les 30 secondes.
 *
 * @param {Function} callback - Fonction à appeler (ex: fetchScores)
 * @param {number} delay - Intervalle en millisecondes (défaut: 30000)
 * @param {boolean} enabled - Activer/désactiver le polling
 */
function usePolling(callback, delay = 30000, enabled = true) {
  const savedCallback = useRef(callback);

  // Toujours garder la référence à jour sans relancer l'effet
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    // Premier appel immédiat
    savedCallback.current();

    const interval = setInterval(() => {
      savedCallback.current();
    }, delay);

    return () => clearInterval(interval);
  }, [delay, enabled]);
}

export default usePolling;
