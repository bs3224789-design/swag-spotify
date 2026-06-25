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
    console.log('🔑 Токен:', accessToken.substring(0, 30) + '...');
    res.redirect(`/?access_token=${accessToken}`);
  } catch (error) {
    console.error('❌ Ошибка авторизации:', error);
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
    console.error('❌ Ошибка токена:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ==================================================
// 4. ПОИСК — С ПОДРОБНЫМИ ЛОГАМИ
// ==================================================
app.get('/api/search', async (req, res) => {
  console.log('🔍 ===== НОВЫЙ ЗАПРОС ПОИСКА =====');
  console.log('📝 Параметры запроса:', req.query);
  
  const query = req.query.q;
  if (!query) {
    console.log('❌ Нет параметра q');
    return res.status(400).json({ error: 'Нет запроса' });
  }

  console.log('✅ Ищем трек:', query);

  // Проверяем токен
  console.log('🔑 Токен в памяти:', accessToken ? 'ЕСТЬ ✅' : 'НЕТ ❌');
  console.log('⏰ Время истечения:', tokenExpirationTime ? new Date(tokenExpirationTime).toISOString() : 'НЕТ');
  console.log('⏰ Текущее время:', new Date().toISOString());

  try {
    // Если токен протух или его нет — пробуем обновить
    if (!accessToken || Date.now() > tokenExpirationTime) {
      console.log('🔄 Токен протух или отсутствует, пробуем обновить...');
      if (refreshToken) {
        console.log('🔄 Есть refreshToken, обновляем...');
        const data = await spotifyApi.refreshAccessToken();
        accessToken = data.body['access_token'];
        tokenExpirationTime = Date.now() + data.body['expires_in'] * 1000;
        spotifyApi.setAccessToken(accessToken);
        console.log('✅ Токен обновлён!');
      } else {
        console.log('❌ Нет refreshToken!');
        return res.status(401).json({ error: 'Нет токена' });
      }
    }

    // Формируем запрос к Spotify
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`;
    console.log('📡 Запрос к Spotify:', url);
    console.log('🔑 Используем токен:', accessToken.substring(0, 30) + '...');

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log('📊 Статус ответа Spotify:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Ошибка Spotify:', errorText);
      return res.status(response.status).json({ 
        error: `Ошибка Spotify: ${response.status}`,
        details: errorText
      });
    }

    const data = await response.json();
    console.log('✅ Найдено треков:', data.tracks?.items?.length || 0);
    
    if (data.tracks?.items?.length === 0) {
      return res.json({ tracks: { items: [] } });
    }

    res.json(data);
  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА ПОИСКА:', error);
    console.error('📚 Стек ошибки:', error.stack);
    res.status(500).json({ 
      error: 'Ошибка поиска',
      message: error.message,
      stack: error.stack
    });
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
