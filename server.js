const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ========================================
// НАСТРОЙКА SPOTIFY
// ========================================
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: process.env.REDIRECT_URI,
});

let accessToken = null;
let refreshToken = null;
let tokenExpirationTime = null;

// ========================================
// 1. ЛОГИН
// ========================================
app.get('/login', (req, res) => {
  const scopes = [
    'user-read-private',
    'user-read-email',
    'streaming',
    'user-modify-playback-state',
    'user-read-playback-state',
    'playlist-read-private',
  ];
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes, 'state');
  res.redirect(authorizeURL);
});

// ========================================
// 2. КОЛБЭК
// ========================================
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('❌ Код не найден!');
  }

  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    accessToken = data.body['access_token'];
    refreshToken = data.body['refresh_token'];
    tokenExpirationTime = Date.now() + data.body['expires_in'] * 1000;

    spotifyApi.setAccessToken(accessToken);
    spotifyApi.setRefreshToken(refreshToken);

    console.log('✅ Авторизация успешна!');
    res.redirect(`/?access_token=${accessToken}`);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    res.status(500).send('Ошибка авторизации');
  }
});

// ========================================
// 3. ПОЛУЧИТЬ ТОКЕН
// ========================================
app.get('/api/token', async (req, res) => {
  try {
    if (accessToken && Date.now() < tokenExpirationTime) {
      return res.json({ accessToken });
    }

    if (refreshToken) {
      const data = await spotifyApi.refreshAccessToken();
      accessToken = data.body['access_token'];
      tokenExpirationTime = Date.now() + data.body['expires_in'] * 1000;
      spotifyApi.setAccessToken(accessToken);
      return res.json({ accessToken });
    }

    return res.status(401).json({ error: 'Нет токена' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ========================================
// 4. ГЛАВНАЯ
// ========================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('');
  console.log('🩸 ========================================');
  console.log('🔥  SWAG SPOTIFY ЗАПУЩЕН!');
  console.log(`🔗  http://localhost:${PORT}`);
  console.log(`👉  Зайди на /login`);
  console.log('🩸 ========================================');
  console.log('');
});