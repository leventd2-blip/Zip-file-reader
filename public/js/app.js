lucide.createIcons();

let loadedZip = null;
let currentActiveEntry = null;
let currentActiveFileName = '';
let allZipFilesMap = {};
let currentUser = null;

// 1. Initialize Supabase Client safely
let supabase = null;
if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase) {
  try {
    supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    initAuth();
  } catch (err) {
    console.warn("Supabase init bypassed:", err);
  }
}

const zipInput = document.getElementById('zipInput');
const dropzone = document.getElementById('dropzone');
const searchInput = document.getElementById('searchInput');
const fileTree = document.getElementById('fileTree');
const previewArea = document.getElementById('previewArea');
const activeFilePath = document.getElementById('activeFilePath');
const activeFileMime = document.getElementById('activeFileMime');
const downloadBtn = document.getElementById('downloadBtn');

// 2. Auth Handlers
async function initAuth() {
  if (!supabase) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      currentUser = user;
      renderUserUI(user);
    }

    supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        currentUser = session.user;
        renderUserUI(session.user);
      } else {
        currentUser = null;
        renderUserUI(null);
      }
    });
  } catch(e) {
    console.error("Auth check failed:", e);
  }
}

function renderUserUI(user) {
  const userProfile = document.getElementById('userProfile');
  const historyBtn = document.getElementById('historyBtn');

  if (user) {
    if (historyBtn) historyBtn.classList.remove('hidden');
    if (userProfile) {
      userProfile.innerHTML = `
        <div class="flex items-center space-x-2">
          <img src="${user.user_metadata?.avatar_url || 'https://github.com/identicons/user.png'}" class="w-6 h-6 rounded-full border border-neutral-700">
          <span class="text-xs font-semibold text-neutral-300 hidden md:inline">${user.user_metadata?.full_name || user.email}</span>
          <button onclick="logout()" class="text-[10px] text-neutral-500 hover:text-white pl-2">Logout</button>
        </div>
      `;
    }
  } else {
    if (historyBtn) historyBtn.classList.add('hidden');
    if (userProfile) {
      userProfile.innerHTML = `
        <button id="loginDiscordBtn" onclick="loginWithDiscord()" class="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition">
          <i data-lucide="disc" class="w-3.5 h-3.5"></i> Login
        </button>
      `;
    }
  }
  lucide.createIcons();
}

async function loginWithDiscord() {
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    alert('Error: SUPABASE_URL or SUPABASE_ANON_KEY missing in Vercel settings!');
    return;
  }

  if (!supabase && window.supabase) {
    supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  }

  if (!supabase) {
    alert('Error: Supabase JS library failed to load.');
    return;
  }

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: window.location.origin + '/explorer' }
    });
    if (error) alert('Discord Login Error: ' + error.message);
  } catch (err) {
    alert('Unexpected Auth Error: ' + err.message);
  }
}

async function logout() {
  if (!supabase) return;
  await supabase.auth.signOut();
  window.location.reload();
}

// 3. File Input & Drag/Drop
if (zipInput) {
  zipInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleZipUpload(e.target.files[0]);
    }
  });
}

if (dropzone) {
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('border-neutral-500');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('border-neutral-500');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('border-neutral-500');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleZipUpload(e.dataTransfer.files[0]);
    }
  });
}

if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    renderTree(allZipFilesMap, e.target.value);
  });
}

// 4. ZIP File Inspector Engine
async function handleZipUpload(file) {
  if (!file) return;

  // Validate extension in JavaScript so iOS Files picker doesn't hide files
  if (!file.name.toLowerCase().endsWith('.zip')) {
    alert('Please select a valid .zip file.');
    return;
  }

  if (typeof JSZip === 'undefined') {
    alert('JSZip library is still loading or blocked. Please refresh the page.');
    return;
  }

  try {
    const zip = new JSZip();
    loadedZip = await zip.loadAsync(file);
    allZipFilesMap = loadedZip.files;

    const entryCount = Object.keys(allZipFilesMap).length;

    const fileMeta = document.getElementById('fileMeta');
    if (fileMeta) fileMeta.classList.remove('hidden');

    const metaName = document.getElementById('metaName');
    const metaSize = document.getElementById('metaSize');
    const metaCount = document.getElementById('metaCount');

    if (metaName) metaName.textContent = file.name;
    if (metaSize) metaSize.textContent = formatBytes(file.size);
    if (metaCount) metaCount.textContent = entryCount;

    renderTree(allZipFilesMap);

    // Attempt history save silently
    if (currentUser) {
      saveProjectHistory(file.name, formatBytes(file.size), entryCount).catch(() => {});
    }
  } catch (err) {
    alert('Failed to read ZIP file: ' + err.message);
    console.error(err);
  }
}

// 5. Tree Rendering
function renderTree(filesMap, filterTerm = '') {
  if (!fileTree) return;
  fileTree.innerHTML = '';

  const entries = Object.keys(filesMap).filter((path) =>
    path.toLowerCase().includes(filterTerm.toLowerCase())
  );

  if (entries.length === 0) {
    fileTree.innerHTML = `<div class="p-6 text-center text-neutral-500 text-xs">No matching files found.</div>`;
    return;
  }

  entries.forEach((path) => {
    const item = filesMap[path];
    const node = document.createElement('div');
    node.className = 'tree-node flex items-center justify-between px-2 py-1 text-neutral-300 rounded hover:bg-neutral-900 transition cursor-pointer';

    const depth = (path.match(/\//g) || []).length;
    node.style.paddingLeft = `${Math.max(8, depth * 12)}px`;

    const isDir = item.dir;
    const iconName = isDir ? 'folder' : 'file-code';

    const uncompressedSize = item._data ? item._data.uncompressedSize : 0;
    const sizeString = isDir || !uncompressedSize ? '' : formatBytes(uncompressedSize);

    node.innerHTML = `
      <div class="flex items-center space-x-2 truncate">
        <i data-lucide="${iconName}" class="w-3.5 h-3.5 text-neutral-400 shrink-0"></i>
        <span class="truncate">${path}</span>
      </div>
      <span class="text-[10px] text-neutral-500 font-mono">${sizeString}</span>
    `;

    if (!isDir) {
      node.addEventListener('click', () => {
        document.querySelectorAll('.tree-node').forEach((n) => n.classList.remove('active'));
        node.classList.add('active');
        fetchPreview(path, item);
      });
    }

    fileTree.appendChild(node);
  });

  lucide.createIcons();
}

// 6. File Preview Engine
async function fetchPreview(filePath, zipEntry) {
  currentActiveEntry = zipEntry;
  currentActiveFileName = filePath.split('/').pop();

  if (activeFilePath) activeFilePath.textContent = filePath;
  if (downloadBtn) downloadBtn.classList.remove('hidden');

  previewArea.innerHTML = `<div class="animate-spin text-white"><i data-lucide="loader-2" class="w-6 h-6"></i></div>`;
  lucide.createIcons();

  const ext = filePath.split('.').pop().toLowerCase();
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'];

  try {
    if (imageExtensions.includes(ext)) {
      const base64 = await zipEntry.async('base64');
      const mime = `image/${ext === 'svg' ? 'svg+xml' : ext}`;
      if (activeFileMime) activeFileMime.textContent = mime;
      previewArea.innerHTML = `
        <div class="p-4 flex items-center justify-center max-h-full">
          <img src="data:${mime};base64,${base64}" class="max-h-[60vh] rounded shadow-2xl border border-neutral-800 object-contain">
        </div>`;
    } else {
      const textContent = await zipEntry.async('string');
      if (activeFileMime) activeFileMime.textContent = `text/${ext || 'plain'}`;

      if (!textContent || textContent.trim() === '') {
        previewArea.innerHTML = `
          <div class="text-center text-neutral-500 font-mono text-xs flex flex-col items-center justify-center h-full">
            <i data-lucide="file-x" class="w-8 h-8 mb-2 opacity-40"></i>
            <span>This file is empty (0 Bytes)</span>
          </div>`;
      } else {
        previewArea.innerHTML = `
          <pre class="w-full h-full bg-neutral-950 p-4 rounded-xl border border-neutral-900 text-emerald-400 font-mono text-xs overflow-auto leading-relaxed"><code>${escapeHtml(textContent)}</code></pre>`;
      }
    }
  } catch (err) {
    if (activeFileMime) activeFileMime.textContent = 'binary';
    previewArea.innerHTML = `
      <div class="text-center p-8 bg-neutral-950 border border-neutral-900 rounded-xl">
        <p class="text-xs text-neutral-500">Binary content cannot be previewed directly.</p>
      </div>`;
  }

  lucide.createIcons();
}

// 7. Helpers & Actions
async function saveProjectHistory(fileName, fileSize, entryCount) {
  if (!currentUser) return;
  await fetch('/api/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: currentUser.id,
      fileName,
      fileSize,
      entryCount
    })
  });
}

async function toggleHistoryModal() {
  const modal = document.getElementById('historyModal');
  if (!modal) return;

  modal.classList.toggle('hidden');

  if (!modal.classList.contains('hidden') && currentUser) {
    const list = document.getElementById('historyList');
    list.innerHTML = `<p class="text-center text-neutral-500 py-8">Loading history...</p>`;

    const res = await fetch(`/api/history/${currentUser.id}`);
    const data = await res.json();

    if (data.history && data.history.length > 0) {
      list.innerHTML = data.history.map(item => `
        <div class="p-3 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between">
          <div>
            <p class="font-bold text-white text-xs">${escapeHtml(item.file_name)}</p>
            <p class="text-[10px] text-neutral-500">${new Date(item.created_at).toLocaleString()}</p>
          </div>
          <div class="text-right text-[10px] text-neutral-400">
            <p>${item.file_size}</p>
            <p>${item.entry_count} files</p>
          </div>
        </div>
      `).join('');
    } else {
      list.innerHTML = `<p class="text-center text-neutral-500 py-8">No history recorded yet.</p>`;
    }
  }
}

if (downloadBtn) {
  downloadBtn.addEventListener('click', async () => {
    if (!currentActiveEntry) return;
    const blob = await currentActiveEntry.async('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentActiveFileName || 'file';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

function formatBytes(bytes) {
  if (typeof bytes === 'string') return bytes;
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}