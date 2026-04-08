/**
 * Script one-shot pour créer le compte super admin initial.
 * À lancer UNE SEULE FOIS : node utils/createSuperAdmin.js
 *
 * Usage : SUPER_ADMIN_PASSWORD=tonmotdepasse node utils/createSuperAdmin.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function createSuperAdmin() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connecté à MongoDB');

  const existing = await User.findOne({ role: 'super_admin' });
  if (existing) {
    console.log(`Super admin déjà existant : ${existing.username}`);
    process.exit(0);
  }

  const username = process.env.SUPER_ADMIN_USERNAME || 'rayaan';
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!password) {
    console.error('Erreur : définir SUPER_ADMIN_PASSWORD en variable d\'environnement');
    console.error('Ex: SUPER_ADMIN_PASSWORD=monmotdepasse node utils/createSuperAdmin.js');
    process.exit(1);
  }

  const user = await User.create({
    username,
    password,
    role: 'super_admin',
    status: 'active',
  });

  console.log(`Super admin créé : ${user.username} (rôle: ${user.role})`);
  process.exit(0);
}

createSuperAdmin().catch(err => {
  console.error('Erreur :', err.message);
  process.exit(1);
});
