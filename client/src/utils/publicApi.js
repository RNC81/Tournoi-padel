// publicApi.js — Instance axios pour les routes /api/public/*
// Ajoute automatiquement la clé API depuis VITE_PUBLIC_API_KEY (variable d'env Render).
// Ne jamais hardcoder la clé ici — elle est injectée au build.

import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/public`
  : '/api/public';

const publicApi = axios.create({
  baseURL,
  headers: {
    'Content-Type':  'application/json',
    'x-api-key':     import.meta.env.VITE_PUBLIC_API_KEY || '',
  },
});

export default publicApi;
