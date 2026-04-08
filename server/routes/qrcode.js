const express = require('express');
const QRCode = require('qrcode');

const router = express.Router();

// GET /api/qrcode — Génère un QR code PNG pointant vers le site public
// Les joueurs scannent ce QR code pour accéder au suivi du tournoi
router.get('/', async (req, res) => {
  try {
    const siteUrl = process.env.PUBLIC_URL || `http://localhost:5173`;

    // Générer le QR code en base64 (PNG)
    const qrDataUrl = await QRCode.toDataURL(siteUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#1a1a2e',   // Couleur sombre pour le QR
        light: '#ffffff',
      },
    });

    res.json({ qr: qrDataUrl, url: siteUrl });
  } catch (err) {
    res.status(500).json({ error: 'Erreur génération QR code' });
  }
});

module.exports = router;
