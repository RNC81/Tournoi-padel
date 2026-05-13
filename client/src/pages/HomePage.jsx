import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'motion/react';
import publicApi from '../utils/publicApi';
import api from '../utils/api';
import { i18n, LANG_KEY } from '../utils/i18n';

// ─── TRAJECTOIRE BÉZIER ───────────────────────────────────────────────────────
// 4 segments cubiques — px = left%, py = top_vh
// P0 = départ, P1 P2 = points de contrôle (créent l'arc), P3 = arrivée
//
//  [0 → 0.22]  centre haut → impact ligne de service gauche
//  [0.22→ 0.50] rebond gauche → arc haut → franchissement filet
//  [0.50→ 0.80] après filet → arc haut → impact service droit
//  [0.80→ 1.00] dernier rebond → fond de court bas
//
const SEGMENTS = [
  { tStart: 0,    tEnd: 0.22,
    px: [50, 44, 32, 28],  py: [8,  16, 28, 38] },
  { tStart: 0.22, tEnd: 0.50,
    px: [28, 30, 66, 50],  py: [38, 14, 18, 48] },
  { tStart: 0.50, tEnd: 0.80,
    px: [50, 42, 30, 70],  py: [48, 26, 44, 65] },
  { tStart: 0.80, tEnd: 1.00,
    px: [70, 62, 52, 50],  py: [65, 72, 83, 90] },
];

// Scroll % où la balle frappe une ligne du terrain → animation de compression
const IMPACT_THRESHOLDS = [0.22, 0.50, 0.80];

// Bézier cubique scalaire
function bezier(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3;
}

// Retourne la position (left%, top_vh) de la balle pour un scroll t ∈ [0,1]
function getBallPos(scrollT) {
  const seg =
    SEGMENTS.find(s => scrollT >= s.tStart && scrollT <= s.tEnd) ??
    (scrollT < 0 ? SEGMENTS[0] : SEGMENTS[SEGMENTS.length - 1]);
  const range = seg.tEnd - seg.tStart;
  const t     = range === 0 ? 1 : Math.min(1, Math.max(0, (scrollT - seg.tStart) / range));
  return { x: bezier(t, ...seg.px), y: bezier(t, ...seg.py) };
}

// Hauteur d'arc normalisée (0 = sol/impact, 1 = pic) pour dimensionner l'ombre.
// Mesure l'écart entre la courbe réelle et la droite P0→P3 du segment.
// "au-dessus de la droite" = actualY < linearY = balle haute.
function getArcHeight(scrollT) {
  const seg =
    SEGMENTS.find(s => scrollT >= s.tStart && scrollT <= s.tEnd) ??
    SEGMENTS[SEGMENTS.length - 1];
  const range   = seg.tEnd - seg.tStart;
  const t       = range === 0 ? 1 : Math.min(1, Math.max(0, (scrollT - seg.tStart) / range));
  const linearY = seg.py[0] + (seg.py[3] - seg.py[0]) * t;
  const actualY = bezier(t, ...seg.py);
  return Math.max(0, (linearY - actualY) / 28);
}

// ─── COURT DE PADEL PLEINE PAGE ───────────────────────────────────────────────
// SVG absolu — couvre toute la hauteur scrollable.
// viewBox="0 0 100 100" + preserveAspectRatio="none" → Y en % = % de page.
//   y=22 → ligne de service haute (stats bar)
//   y=51 → FILET (entre Programme et Règlement)
//   y=79 → ligne de service basse
function FullPageCourt() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      fill="none"
      stroke="#2d6a2d"
      aria-hidden="true"
    >
      <rect x="4" y="0.3" width="92" height="99.4" strokeWidth="0.28" opacity="0.22"/>
      <line x1="4" y1="22"   x2="96" y2="22"   strokeWidth="0.20" opacity="0.16"/>
      <line x1="4" y1="51"   x2="96" y2="51"   strokeWidth="0.60" opacity="0.38"/>
      <line x1="4" y1="51.9" x2="96" y2="51.9" strokeWidth="0.14" opacity="0.13"/>
      <line x1="4" y1="79"   x2="96" y2="79"   strokeWidth="0.20" opacity="0.16"/>
      <line x1="50" y1="0.3" x2="50" y2="22"   strokeWidth="0.14" opacity="0.13"/>
      <line x1="50" y1="79"  x2="50" y2="99.7" strokeWidth="0.14" opacity="0.13"/>
      <circle cx="4"  cy="0.3"  r="0.9" fill="#2d6a2d" stroke="none" opacity="0.14"/>
      <circle cx="96" cy="0.3"  r="0.9" fill="#2d6a2d" stroke="none" opacity="0.14"/>
      <circle cx="4"  cy="99.7" r="0.9" fill="#2d6a2d" stroke="none" opacity="0.14"/>
      <circle cx="96" cy="99.7" r="0.9" fill="#2d6a2d" stroke="none" opacity="0.14"/>
    </svg>
  );
}

// ─── BOUTON PERMISSION GYROSCOPE ──────────────────────────────────────────────
// Affiché une seule fois sur mobile si la permission n'a pas encore été demandée.
function GyroButton({ onPermissionResult }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    if (!isMobile || typeof DeviceOrientationEvent === 'undefined') return;

    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+ : permission explicite requise
      setVisible(true);
    } else {
      // Android / autres : permission implicite
      onPermissionResult('granted');
    }
  }, [onPermissionResult]);

  const handleRequest = async () => {
    setVisible(false);
    try {
      const result = await DeviceOrientationEvent.requestPermission();
      onPermissionResult(result);
    } catch (_) {
      onPermissionResult('denied');
    }
  };

  if (!visible) return null;

  return (
    <button
      onClick={handleRequest}
      title="Activer le gyroscope"
      style={{
        position:       'fixed',
        bottom:         '24px',
        right:          '24px',
        zIndex:         30,
        width:          '44px',
        height:         '44px',
        borderRadius:   '50%',
        background:     '#2d6a2d',
        border:         '2px solid rgba(200,232,50,0.4)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        fontSize:       '20px',
        boxShadow:      '0 4px 16px rgba(45,106,45,0.5)',
        cursor:         'pointer',
        animation:      'gyro-pulse 2s ease-in-out infinite',
      }}
      aria-label="Activer le gyroscope"
    >
      🎾
    </button>
  );
}

// ─── BADGE MODE PHYSIQUE ACTIF ─────────────────────────────────────────────────
// Remplace le bouton une fois la permission accordée.
// "Incline pour jouer" disparaît après 3s.
function GyroActiveBadge() {
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      position:       'fixed',
      bottom:         '24px',
      right:          '24px',
      zIndex:         30,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'flex-end',
      gap:            '6px',
      pointerEvents:  'none',
    }}>
      {showHint && (
        <div style={{
          background:     'rgba(45,106,45,0.92)',
          color:          '#c8e832',
          fontSize:       '11px',
          fontWeight:     600,
          letterSpacing:  '0.06em',
          padding:        '5px 12px',
          borderRadius:   '20px',
          border:         '1px solid rgba(200,232,50,0.35)',
          whiteSpace:     'nowrap',
          backdropFilter: 'blur(8px)',
          animation:      'fade-in 0.3s ease',
        }}>
          Incline pour jouer
        </div>
      )}
      <div style={{
        width:        '44px',
        height:       '44px',
        borderRadius: '50%',
        background:   '#2d6a2d',
        border:       '2px solid #c8e832',
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        fontSize:     '20px',
        boxShadow:    '0 4px 16px rgba(45,106,45,0.6), 0 0 0 4px rgba(200,232,50,0.18)',
      }}>
        🎾
      </div>
    </div>
  );
}

// ─── BALLE ANIMÉE ─────────────────────────────────────────────────────────────
// Mode scroll  : trajectoire Bézier pilotée par scrollYProgress.
// Mode physique: simulation force/vélocité/rebonds pilotée par le gyroscope.
// Les deux modes partagent la même boucle RAF et les mêmes écritures DOM.
// Zéro re-render React.
function AnimatedBall() {
  const { scrollYProgress } = useScroll();

  const ballRef   = useRef(null);
  const shadowRef = useRef(null);
  const trail1Ref = useRef(null);
  const trail2Ref = useRef(null);
  const trail3Ref = useRef(null);

  // Flashs de bord — un div fixe par mur, animé 50ms à chaque rebond
  const flashLeftRef   = useRef(null);
  const flashRightRef  = useRef(null);
  const flashTopRef    = useRef(null);
  const flashBottomRef = useRef(null);

  const [gyroPermission, setGyroPermission] = useState('unknown');
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  const handlePermissionResult = useCallback((result) => {
    setGyroPermission(result);
  }, []);

  // État interne mutable — aucune liaison avec le cycle de rendu React
  const iv = useRef({
    // Mode scroll
    targetX:  50, targetY:  8,
    currentX: 50, currentY: 8,
    prevX:    50, prevY:    8,
    rotation:     0,
    lastT:        0,
    lastImpactAt: -1,
    pendingImpact: false,
    arcH:         0,
    trail: [{ x: 50, y: 8 }, { x: 50, y: 8 }, { x: 50, y: 8 }],
    rafId: null,
    // Mode physique
    physicsActive:     false,
    gyroJustGranted:   false,  // flag → active la physique à la prochaine frame
    physX: 50, physY: 8,       // position physique (%, vh)
    vx: 0,     vy: 0,          // vélocité en unités/frame
    gyroFx: 0, gyroFy: 0,      // forces gyroscope courantes
    physicsLastBounce: -1,     // timestamp dernier rebond (cooldown 50ms)
    pendingBounceWall: null,   // 'left' | 'right' | 'top' | 'bottom'
  });

  // ── Activation physique quand gyroPermission → 'granted' ─────────────────
  useEffect(() => {
    if (gyroPermission === 'granted') {
      iv.current.gyroJustGranted = true;
    }
  }, [gyroPermission]);

  // ── Listener deviceorientation ────────────────────────────────────────────
  useEffect(() => {
    if (!isMobile || gyroPermission !== 'granted') return;

    function onOrientation(e) {
      const state = iv.current;
      if (!state.physicsActive) return;
      const gamma = Math.max(-90, Math.min(90, e.gamma || 0));
      const beta  = Math.max(-90, Math.min(90, (e.beta  || 0) - 45));
      // Forces avec scaling 0.005 — réactif sans être ingérable
      state.gyroFx = gamma * 0.005;
      state.gyroFy = beta  * 0.005;
    }

    window.addEventListener('deviceorientation', onOrientation, { passive: true });
    return () => window.removeEventListener('deviceorientation', onOrientation);
  }, [gyroPermission, isMobile]);

  // ── Boucle RAF principale ─────────────────────────────────────────────────
  useEffect(() => {
    const TRAIL_REFS  = [trail1Ref, trail2Ref, trail3Ref];
    const TRAIL_SIZES = [14, 10, 7];
    const TRAIL_OPAC  = [0.4, 0.2, 0.08];
    const LERP        = 0.12;
    const FLASH_REFS  = {
      left: flashLeftRef, right: flashRightRef,
      top:  flashTopRef,  bottom: flashBottomRef,
    };

    function rafLoop() {
      const state = iv.current;

      // ── Activation physique (exécuté une seule fois à la permission) ───────
      if (state.gyroJustGranted) {
        state.gyroJustGranted   = false;
        state.physX             = state.currentX;
        state.physY             = state.currentY;
        state.vx                = (Math.random() - 0.5) * 4;  // [-2, 2]
        state.vy                = -(Math.random() * 2 + 1);    // [-3, -1] vers le haut
        state.physicsActive     = true;
        state.gyroFx            = 0;
        state.gyroFy            = 0;
        state.physicsLastBounce = -1;

        // Passer en mode "par-dessus tout" + taille 24px
        // TODO : si on ajoute un bouton désactivation gyroscope,
        //        remettre zIndex à 15 et taille à 18px ici.
        if (ballRef.current) {
          ballRef.current.style.zIndex = '9999';
          ballRef.current.style.width  = '24px';
          ballRef.current.style.height = '24px';
        }
        if (shadowRef.current) {
          shadowRef.current.style.zIndex = '9998';
          shadowRef.current.style.width  = '24px';
          shadowRef.current.style.height = '24px';
        }
        [trail1Ref, trail2Ref, trail3Ref].forEach(r => {
          if (r.current) r.current.style.zIndex = '9997';
        });
      }

      let finalX, finalY, speed, shadowW, shadowOpac;

      if (state.physicsActive) {
        // ── MODE PHYSIQUE ──────────────────────────────────────────────────────

        state.prevX = state.physX;
        state.prevY = state.physY;

        // Force gyroscope → vélocité → position
        state.vx += state.gyroFx;
        state.vy += state.gyroFy;
        state.vx *= 0.992;   // friction légère — glisse longtemps
        state.vy *= 0.992;
        state.physX += state.vx;
        state.physY += state.vy;

        // Rebonds sur les 4 bords du viewport (cooldown 50ms pour éviter double-trigger)
        const RESTITUTION = 0.85;
        const ballRadius  = 12;  // 24px / 2 — rayon en pixels (taille physique = 24px)
        const bW  = ballRadius / window.innerWidth  * 100;
        const bH  = ballRadius / window.innerHeight * 100;
        const nowB      = Date.now();
        const canBounce = nowB - state.physicsLastBounce > 50;

        if (state.physX < bW) {
          state.physX = bW;
          if (state.vx < 0) {
            state.vx = Math.abs(state.vx) * RESTITUTION;
            if (canBounce) { state.physicsLastBounce = nowB; state.pendingImpact = true; state.pendingBounceWall = 'left'; }
          }
        }
        if (state.physX > 100 - bW) {
          state.physX = 100 - bW;
          if (state.vx > 0) {
            state.vx = -Math.abs(state.vx) * RESTITUTION;
            if (canBounce) { state.physicsLastBounce = nowB; state.pendingImpact = true; state.pendingBounceWall = 'right'; }
          }
        }
        if (state.physY < bH) {
          state.physY = bH;
          if (state.vy < 0) {
            state.vy = Math.abs(state.vy) * RESTITUTION;
            if (canBounce) { state.physicsLastBounce = nowB; state.pendingImpact = true; state.pendingBounceWall = 'top'; }
          }
        }
        if (state.physY > 100 - bH) {
          state.physY = 100 - bH;
          if (state.vy > 0) {
            state.vy = -Math.abs(state.vy) * RESTITUTION;
            if (canBounce) { state.physicsLastBounce = nowB; state.pendingImpact = true; state.pendingBounceWall = 'bottom'; }
          }
        }

        finalX = state.physX;
        finalY = state.physY;

        const vwP = window.innerWidth;
        const vhP = window.innerHeight;
        const dxP = (finalX - state.prevX) * vwP / 100;
        const dyP = (finalY - state.prevY) * vhP / 100;
        speed      = Math.sqrt(dxP * dxP + dyP * dyP);
        shadowW    = 0.55;
        shadowOpac = 0.08;

      } else {
        // ── MODE SCROLL ────────────────────────────────────────────────────────

        state.prevX = state.currentX;
        state.prevY = state.currentY;

        state.currentX += (state.targetX - state.currentX) * LERP;
        state.currentY += (state.targetY - state.currentY) * LERP;

        finalX = Math.max(4, Math.min(96, state.currentX));
        finalY = Math.max(2, Math.min(95, state.currentY));

        const vwS = window.innerWidth;
        const vhS = window.innerHeight;
        const dxS = (finalX - state.prevX) * vwS / 100;
        const dyS = (finalY - state.prevY) * vhS / 100;
        speed      = Math.sqrt(dxS * dxS + dyS * dyS);

        const distToTarget =
          Math.abs(state.targetX - state.currentX) +
          Math.abs(state.targetY - state.currentY);

        // Seuil minimum — skip DOM si balle quasi immobile
        if (speed <= 0.02 && distToTarget <= 0.05) {
          state.rafId = requestAnimationFrame(rafLoop);
          return;
        }

        shadowW    = 0.55 + state.arcH * 1.1;
        shadowOpac = 0.05 + state.arcH * 0.10;
      }

      // ── Commun : rotation + traîne ─────────────────────────────────────────
      state.rotation += speed * 5;
      state.trail = [
        { x: state.prevX, y: state.prevY },
        state.trail[0],
        state.trail[1],
      ];

      // ── Écriture DOM ───────────────────────────────────────────────────────
      if (ballRef.current) {
        ballRef.current.style.left = `${finalX}%`;
        ballRef.current.style.top  = `${finalY}vh`;

        if (state.pendingImpact) {
          state.pendingImpact = false;
          ballRef.current.animate(
            [
              { transform: `translate(-50%, -50%) rotate(${state.rotation}deg) scaleY(1) scaleX(1)` },
              { transform: `translate(-50%, -50%) rotate(${state.rotation + 8}deg) scaleY(0.72) scaleX(1.22)` },
              { transform: `translate(-50%, -50%) rotate(${state.rotation + 18}deg) scaleY(1) scaleX(1)` },
            ],
            { duration: 100, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', fill: 'none' }
          );
          // Flash du bord touché — ligne #c8e832 de 2px, visible 50ms
          if (state.pendingBounceWall) {
            const fRef = FLASH_REFS[state.pendingBounceWall];
            if (fRef?.current) {
              fRef.current.animate(
                [{ opacity: 0.85 }, { opacity: 0 }],
                { duration: 50, easing: 'ease-out', fill: 'none' }
              );
            }
            state.pendingBounceWall = null;
          }
        } else {
          ballRef.current.style.transform =
            `translate(-50%, -50%) rotate(${state.rotation}deg)`;
        }
      }

      if (shadowRef.current) {
        shadowRef.current.style.left      = `${finalX}%`;
        shadowRef.current.style.top       = `${finalY}vh`;
        shadowRef.current.style.transform =
          `translate(-50%, 14px) scaleX(${shadowW}) scaleY(0.28)`;
        shadowRef.current.style.opacity   = String(shadowOpac);
      }

      TRAIL_REFS.forEach((ref, i) => {
        if (!ref.current) return;
        const tp = state.trail[i];
        // En mode physique, tp.x/y sont déjà en coordonnées finales
        // En mode scroll, idem (currentX/Y sans offset gyro)
        ref.current.style.left      = `${tp.x}%`;
        ref.current.style.top       = `${tp.y}vh`;
        ref.current.style.transform = 'translate(-50%, -50%)';
        ref.current.style.opacity   = speed > 0.6 ? String(TRAIL_OPAC[i]) : '0';
        const sz = `${TRAIL_SIZES[i]}px`;
        ref.current.style.width  = sz;
        ref.current.style.height = sz;
      });

      state.rafId = requestAnimationFrame(rafLoop);
    }

    // ── Handler scroll : cible seulement, pas de DOM ──────────────────────────
    const unsubscribe = scrollYProgress.on('change', (scrollT) => {
      const state = iv.current;
      if (state.physicsActive) return; // scroll ignoré en mode physique
      const { x, y } = getBallPos(scrollT);
      state.targetX = x;
      state.targetY = y;
      state.arcH    = getArcHeight(scrollT);

      const now = Date.now();
      const isImpact =
        now - state.lastImpactAt > 300 &&
        IMPACT_THRESHOLDS.some(
          th => (state.lastT < th && scrollT >= th) ||
                (state.lastT > th && scrollT <= th)
        );
      if (isImpact) {
        state.lastImpactAt  = now;
        state.pendingImpact = true;
      }
      state.lastT = scrollT;
    });

    iv.current.rafId = requestAnimationFrame(rafLoop);

    return () => {
      unsubscribe();
      if (iv.current.rafId) cancelAnimationFrame(iv.current.rafId);
    };
  }, [scrollYProgress]);

  const base = {
    position:      'fixed',
    borderRadius:  '50%',
    pointerEvents: 'none',
    zIndex:        15,
  };

  return (
    <>
      {/* Flashs de rebond — un bord par mur, opacity 0 au repos, animés 50ms */}
      <div ref={flashLeftRef}   style={{ position: 'fixed', pointerEvents: 'none', zIndex: 9996, opacity: 0, left: 0,    top: 0,    width: '2px',  height: '100vh', background: '#c8e832' }} />
      <div ref={flashRightRef}  style={{ position: 'fixed', pointerEvents: 'none', zIndex: 9996, opacity: 0, right: 0,   top: 0,    width: '2px',  height: '100vh', background: '#c8e832' }} />
      <div ref={flashTopRef}    style={{ position: 'fixed', pointerEvents: 'none', zIndex: 9996, opacity: 0, top: 0,     left: 0,   width: '100vw', height: '2px',  background: '#c8e832' }} />
      <div ref={flashBottomRef} style={{ position: 'fixed', pointerEvents: 'none', zIndex: 9996, opacity: 0, bottom: 0,  left: 0,   width: '100vw', height: '2px',  background: '#c8e832' }} />

      <div ref={shadowRef} style={{ ...base, zIndex: 14, width: '18px', height: '18px', background: '#2d6a2d', opacity: 0 }} />
      <div ref={trail3Ref} style={{ ...base, width: '7px',  height: '7px',  background: '#c8e832', opacity: 0 }} />
      <div ref={trail2Ref} style={{ ...base, width: '10px', height: '10px', background: '#c8e832', opacity: 0 }} />
      <div ref={trail1Ref} style={{ ...base, width: '14px', height: '14px', background: '#c8e832', opacity: 0 }} />
      <div ref={ballRef} style={{
        ...base,
        width:      '18px',
        height:     '18px',
        background: '#c8e832',
        boxShadow:  '0 2px 10px rgba(200, 232, 50, 0.55)',
        top:        '8vh',
        left:       '50%',
        transform:  'translate(-50%, -50%)',
      }} />

      {/* Bouton permission — mobile + pas encore demandé */}
      {isMobile && gyroPermission === 'unknown' && (
        <GyroButton onPermissionResult={handlePermissionResult} />
      )}

      {/* Badge mode actif — remplace le bouton une fois accordé */}
      {isMobile && gyroPermission === 'granted' && (
        <GyroActiveBadge />
      )}
    </>
  );
}

// ─── INDICATEUR DE SCROLL ─────────────────────────────────────────────────────
// Visible au démarrage, disparaît dès que l'utilisateur commence à scroller (> 5%).
function ScrollHint() {
  const { scrollYProgress } = useScroll();
  // Fondu : opacity 1 à scroll=0, opacity 0 à scroll=0.05
  const opacity = useTransform(scrollYProgress, [0, 0.05], [1, 0]);

  return (
    <motion.div
      style={{ opacity }}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none select-none"
      aria-hidden="true"
    >
      <motion.div
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg
          className="w-5 h-5"
          style={{ color: '#999' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7"/>
        </svg>
      </motion.div>
      <span style={{ fontSize: '10px', color: '#999', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
        Scroll
      </span>
    </motion.div>
  );
}

// ─── PAGE D'ACCUEIL ───────────────────────────────────────────────────────────
export default function HomePage() {
  const [tournament,  setTournament]  = useState(null);
  const [qrCode,      setQrCode]      = useState(null);
  const [rulesAvail,  setRulesAvail]  = useState(false);
  const [lang,        setLang]        = useState(() => localStorage.getItem(LANG_KEY) || 'fr');

  // Écoute les changements de langue déclenchés par la Navbar
  useEffect(() => {
    const handler = (e) => setLang(e.detail);
    window.addEventListener('padel-lang-change', handler);
    return () => window.removeEventListener('padel-lang-change', handler);
  }, []);

  useEffect(() => {
    publicApi.get('/tournament').then(r => setTournament(r.data)).catch(() => {});
    api.get('/qrcode').then(r => setQrCode(r.data.qr)).catch(() => {});
    // Vérifier si le PDF règlement est disponible
    publicApi.get('/document/rules', { params: { info: '1' } })
      .then(r => setRulesAvail(r.data?.exists === true))
      .catch(() => setRulesAvail(false));
  }, []);

  const t = i18n[lang].home;

  const status      = tournament?.status   ?? null;
  const teamCount   = tournament?.teamCount ?? null;
  const maxTeams    = tournament?.maxTeams  ?? 100;
  const progression = teamCount != null ? Math.round((teamCount / maxTeams) * 100) : 0;

  const isRegistration = !status || status === 'registration';
  const isLive         = status === 'group_stage' || status === 'knockout';

  return (
    <div className="relative bg-beige">

      {/* Court SVG — fond pleine page absolue, z-index 0 */}
      <FullPageCourt />

      {/* Balle — fixed, scroll-driven, z-index 14-15 */}
      <AnimatedBall />

      {/* ─── HERO ─────────────────────────────────────────────────────────── */}
      {/* Zone : fond de court supérieur (entre mur et ligne de service) */}
      <section className="relative z-10 min-h-screen flex items-center pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full">
          <div className="max-w-2xl space-y-7">

            {/* Titre massif — empilé vertical */}
            <div className="leading-none">
              {['TOURNOI', 'PARIS', 'YAAR', 'CLUB'].map((word, i) => (
                <h1
                  key={word}
                  className={`font-display font-black block ${i === 2 ? '' : 'text-forest'}`}
                  style={{
                    fontSize: 'clamp(3.5rem, 10vw, 8rem)',
                    lineHeight: 0.88,
                    ...(i === 2 ? { WebkitTextStroke: '2px #2d6a2d', color: 'transparent' } : {}),
                  }}
                >
                  {word}
                </h1>
              ))}
            </div>

            {/* Infos date / lieu / format */}
            <div className="flex flex-wrap gap-5 text-forest/55 text-sm font-medium pt-1">
              {[
                { icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', label: '14 & 16 Mai 2026' },
                { icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z', label: 'Paris Yaar Club' },
                { icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', label: 'Format 2v2' },
              ].map(({ icon, label }) => (
                <span key={label} className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-forest/60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon}/>
                  </svg>
                  {label}
                </span>
              ))}
            </div>

            {/* Barre de progression inscriptions */}
            {teamCount != null && (
              <div className="space-y-1.5 max-w-xs">
                <div className="flex justify-between text-sm">
                  <span className="text-forest/55">{t.equipesInscrites}</span>
                  <span className="text-forest font-bold">
                    {teamCount} <span className="text-forest/30 font-normal">{t.sur} {maxTeams}</span>
                  </span>
                </div>
                <div className="h-1.5 bg-forest/12 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${progression}%`, background: 'linear-gradient(90deg, #2d6a2d, #c8e832)' }}
                  />
                </div>
                <p className="text-forest/35 text-xs">{t.placesRestantes(maxTeams - teamCount)}</p>
              </div>
            )}

            {/* CTA */}
            <div className="flex flex-wrap gap-3 pt-1">
              {isRegistration && (
                <Link
                  to="/inscription"
                  className="inline-flex items-center gap-2 bg-forest hover:bg-forest-dark text-white font-bold px-7 py-3.5 rounded-xl text-base transition-all active:scale-95"
                >
                  {t.sInscrire}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                  </svg>
                </Link>
              )}
              <Link
                to="/tournoi"
                className="inline-flex items-center gap-2 border-2 border-forest text-forest hover:bg-forest hover:text-white font-bold px-7 py-3.5 rounded-xl text-base transition-all active:scale-95"
              >
                {t.suivreTournoi}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              </Link>
            </div>
          </div>
        </div>

        {/* Indicateur scroll — disparaît après 5% de scroll */}
        <ScrollHint />
      </section>

      {/* ─── STATS BAR ─────────────────────────────────────────────────────── */}
      {/* Zone : ligne de service supérieure */}
      <section className="relative z-10 bg-forest">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/15">
            <StatItem
              value={teamCount != null ? String(teamCount) : '—'}
              label={t.equipesInscrites}
              sub={`${t.sur} ${maxTeams} max`}
            />
            <StatItem value="2v2"  label={t.statFormat}  sub={t.statDoublettes}    />
            <StatItem value="2"    label={t.statJours}   sub="14 & 16 Mai"         />
            <StatItem value="1/16" label={t.statFinale}  sub={t.statBracket}       />
          </div>
        </div>
      </section>

      {/* ─── PROGRAMME ─────────────────────────────────────────────────────── */}
      {/* Zone : fond de court + zone de service haute (au-dessus du filet) */}
      <section id="programme" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="mb-12">
          <p className="text-forest/50 text-sm font-bold uppercase tracking-widest mb-2">{t.calendrier}</p>
          <h2 className="font-display font-black text-4xl md:text-5xl text-forest">{t.deroulement}</h2>
        </div>

        <div className="relative max-w-2xl">
          <div
            className="absolute left-6 top-2 bottom-2 w-0.5 rounded-full"
            style={{ background: 'linear-gradient(to bottom, #c8e832, #2d6a2d30)' }}
          />
          <div className="space-y-0">
            {t.timeline.map((item, i) => (
              <TimelineItem
                key={i}
                num={String(i + 1).padStart(2, '0')}
                titre={item.titre}
                desc={item.desc(maxTeams)}
                date={item.date}
                status={
                  i === 0 ? (!status || status === 'registration' ? 'current' : 'done')
                  : i === 1 ? (status === 'group_stage' ? 'current' : (status === 'knockout' || status === 'finished') ? 'done' : 'upcoming')
                  : (status === 'knockout' ? 'current' : status === 'finished' ? 'done' : 'upcoming')
                }
                doneLabel={t.statusDone}
                currentLabel={t.statusCurrent}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ─── SÉPARATEUR FILET ──────────────────────────────────────────────── */}
      <div className="relative z-10 py-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div
            className="h-px rounded-full"
            style={{ background: 'linear-gradient(90deg, transparent, #2d6a2d22, #2d6a2d55, #2d6a2d22, transparent)' }}
          />
          <p className="text-center text-[10px] font-bold text-forest/25 uppercase tracking-[0.3em] mt-2">
            — filet —
          </p>
        </div>
      </div>

      {/* ─── RÈGLEMENT ─────────────────────────────────────────────────────── */}
      {/* Zone : zone de service basse (sous le filet) */}
      <section id="reglement" className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <div className="flex flex-col items-start gap-6 w-full max-w-3xl">
            <div>
              <p className="text-forest/50 text-sm font-bold uppercase tracking-widest mb-2">{t.aSavoir}</p>
              <h2 className="font-display font-black text-4xl md:text-5xl text-forest">{t.reglementOfficiel}</h2>
            </div>
            <div className="w-16 h-1 rounded-full" style={{ background: '#c8e832' }} />
            {rulesAvail ? (
              <>
                {/* iframe PDF — desktop uniquement */}
                <iframe
                  src={`${import.meta.env.VITE_API_URL || ''}/api/public/document/rules`}
                  title={t.reglementOfficiel}
                  className="hidden sm:block w-full rounded-lg"
                  style={{ height: '600px', border: '1px solid #e8e5de', borderRadius: '8px' }}
                />
                {/* Bouton — toujours visible */}
                <a
                  href={`${import.meta.env.VITE_API_URL || ''}/api/public/document/rules`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-forest hover:bg-forest-dark text-white font-bold px-6 py-3 rounded-xl text-sm transition-all active:scale-95"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  {t.consulterReglement}
                </a>
              </>
            ) : (
              <p className="text-forest/40 text-sm italic">{t.reglement} — {lang === 'fr' ? 'bientôt disponible' : 'coming soon'}</p>
            )}
          </div>
        </div>
      </section>

      {/* ─── QR CODE + INSTAGRAM ───────────────────────────────────────────── */}
      {/* Zone : fond de court inférieur */}
      <section className="relative z-10 bg-forest">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="grid md:grid-cols-2 gap-6 max-w-xl mx-auto">

            <div className="bg-white/10 border border-white/15 rounded-2xl p-6 text-center hover:bg-white/15 transition-colors">
              <p className="text-lime text-xs font-bold uppercase tracking-widest mb-4">{t.accesRapide}</p>
              {qrCode ? (
                <img src={qrCode} alt="QR code du tournoi" className="mx-auto w-32 h-32 rounded-xl mb-4 bg-white p-1"/>
              ) : (
                <div className="mx-auto w-32 h-32 bg-white/10 rounded-xl mb-4 flex items-center justify-center text-white/30 text-xs">QR code</div>
              )}
              <h3 className="font-bold text-white mb-1">{t.scannerPourSuivre}</h3>
              <p className="text-white/50 text-xs">{t.accesDirect}</p>
            </div>

            <div className="bg-white/10 border border-white/15 rounded-2xl p-6 text-center hover:bg-white/15 transition-colors">
              <p className="text-lime text-xs font-bold uppercase tracking-widest mb-4">{t.reseauSocial}</p>
              <div className="mx-auto w-32 h-32 rounded-xl mb-4 bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
                <svg className="w-14 h-14 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
              </div>
              <h3 className="font-bold text-white mb-1">@parisyaarclub</h3>
              <a
                href="https://www.instagram.com/parisyaarclub/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-400 to-purple-500 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition mt-2"
              >
                {t.nousPartagerBtn}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ────────────────────────────────────────────────────────── */}
      {/* Zone : coin de court */}
      <footer className="relative z-10 bg-forest-dark py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-sm">{t.copyright}</p>
          <div className="flex items-center gap-5 text-sm text-white/30">
            <a href="/#programme" className="hover:text-white/60 transition-colors">{i18n[lang].nav.programme}</a>
            <a href="/#reglement" className="hover:text-white/60 transition-colors">{i18n[lang].nav.reglement}</a>
            <Link to="/tournoi"   className="hover:text-white/60 transition-colors">{t.footerScores}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Composants utilitaires ───────────────────────────────────────────────────

function TimelineItem({ num, titre, desc, status, date, doneLabel = 'Terminé', currentLabel = 'En cours' }) {
  const styles = {
    done:     { dot: 'bg-forest',    ring: 'ring-beige', label: doneLabel,    labelColor: 'text-forest/60'       },
    current:  { dot: 'bg-lime',      ring: 'ring-beige', label: currentLabel, labelColor: 'text-forest font-bold' },
    upcoming: { dot: 'bg-forest/20', ring: 'ring-beige', label: '',           labelColor: ''                      },
  };
  const s = styles[status] || styles.upcoming;

  return (
    <div className="relative pl-16 pb-10 last:pb-0">
      <div className={`absolute left-4 top-1.5 w-4 h-4 rounded-full ${s.dot} -translate-x-1/2 ring-4 ${s.ring}`} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <span className="text-forest/25 text-xs font-mono tracking-wider">{num}</span>
            <h3 className="font-display font-bold text-xl text-forest">{titre}</h3>
            {s.label && (
              <span className={`text-xs uppercase tracking-widest ${s.labelColor}`}>{s.label}</span>
            )}
          </div>
          <p className="text-forest/55 text-sm leading-relaxed max-w-lg">{desc}</p>
        </div>
        <span className="text-forest/30 text-xs shrink-0 mt-1 whitespace-nowrap">{date}</span>
      </div>
    </div>
  );
}


function StatItem({ value, label, sub }) {
  return (
    <div className="text-center px-4 py-2 first:pl-0 last:pr-0">
      <div className="font-display font-black text-3xl md:text-4xl text-lime">{value}</div>
      <div className="font-semibold text-white text-sm mt-0.5">{label}</div>
      <div className="text-white/40 text-xs mt-0.5">{sub}</div>
    </div>
  );
}
