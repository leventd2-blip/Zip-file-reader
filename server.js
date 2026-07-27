const express = require('express');
const path = require('path');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Subdomain Router Middleware
app.use((req, res, next) => {
  const host = req.headers.host || '';

  // If request comes from app.zipvault.ddns.net or /app path
  if (host.startsWith('app.') || req.path === '/app') {
    return res.render('explorer');
  }

  // Fallback to landing page for root domain zipvault.ddns.net
  if (req.path === '/') {
    return res.render('landing');
  }

  next();
});

module.exports = app;

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
}