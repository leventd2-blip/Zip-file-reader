const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();

app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Supabase Client safely
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// 1. Landing Page / Dashboard
app.get('/', (req, res) => {
  res.render('landing');
});

// 2. ZIP Explorer Workspace
app.get('/explorer', (req, res) => {
  res.render('explorer', {
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
  });
});

// 3. API Route to save uploaded project history
app.post('/api/history', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase client not initialized' });

  const { userId, fileName, fileSize, entryCount } = req.body;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { data, error } = await supabase
    .from('project_history')
    .insert([{ user_id: userId, file_name: fileName, file_size: fileSize, entry_count: entryCount }]);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

// 4. API Route to fetch project history for a user
app.get('/api/history/:userId', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase client not initialized' });

  const { userId } = req.params;
  const { data, error } = await supabase
    .from('project_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, history: data });
});

module.exports = app;

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}