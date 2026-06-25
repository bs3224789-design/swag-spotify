const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: process.env.REDIRECT_URI,
});

let accessToken = null;
let refreshToken = null;
let tokenExpirationTime = null;

app.use(express.static('public'));

// ==================================================
// 1. ЛОГИН
// ==================================================
app.get('/login', (req, res) => {
  const scopes = [
    'user-read-private',
    'user-read-email',
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-library-read',
    'user-top-read',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming'
  ];
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes, 'state');
  res.redirect(authorizeURL);
});

// ==================================================
// 2. КОЛБЭК
// ==================================================
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

// ==================================================
// 3. ТОКЕН
// ==================================================
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
    console.error('❌ Ошибка:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ==================================================
// 4. ПОИСК — ИСПРАВЛЕННЫЙ!
// ==================================================
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Нет запроса' });
  }

  console.log('🔍 Ищем:', query);

  try {
    if (!accessToken || Date.now() > tokenExpirationTime) {
      if (refreshToken) {
        const data = await spotifyApi.refreshAccessToken();
        accessToken = data.body['access_token'];
        tokenExpirationTime = Date.now() + data.body['expires_in'] * 1000;
        spotifyApi.setAccessToken(accessToken);
      } else {
        return res.status(401).json({ error: 'Нет токена' });
      }
    }

    // ВАЖНО: добавляем method: 'GET' и Content-Type
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();

    if (data.error) {
      console.log('❌ Ошибка Spotify:', data.error);
      return res.status(data.error.status || 500).json({ error: data.error.message });
    }

    console.log('✅ Найдено треков:', data.tracks?.items?.length || 0);
    res.json(data);
  } catch (error) {
    console.error('❌ Ошибка поиска:', error);
    res.status(500).json({ error: 'Ошибка поиска' });
  }
});

// ==================================================
// 5. ГЛАВНАЯ
// ==================================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================================================
// 6. ЗАПУСК
// ==================================================
app.listen(PORT, () => {
  console.log('');
  console.log('🩸 ========================================');
  console.log('🔥  SWAG SPOTIFY ЗАПУЩЕН!');
  console.log(`🔗  http://localhost:${PORT}`);
  console.log(`👉  Зайди на /login`);
  console.log('🩸 ========================================');
  console.log('');
});
