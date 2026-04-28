require('dotenv').config();
const mongoose = require('mongoose');
const app      = require('./app');

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connecté à MongoDB');
    app.listen(PORT, () => {
      console.log(`✓ Serveur démarré sur http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('✗ Erreur de connexion MongoDB :', err.message);
    process.exit(1);
  }
}

startServer();
