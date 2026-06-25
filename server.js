// ==================================================
// 4. ПОИСК (через сервер, с токеном)
// ==================================================
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Нет запроса' });
  }

  try {
    // Проверяем токен
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

    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const data = await response.json();

    if (data.error) {
      return res.status(data.error.status || 500).json({ error: data.error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('❌ Ошибка поиска:', error);
    res.status(500).json({ error: 'Ошибка поиска' });
  }
});
