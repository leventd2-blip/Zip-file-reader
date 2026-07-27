lucide.createIcons();

let loadedZip = null;
let currentActiveEntry = null;
let currentActiveFileName = '';
let allZipFilesMap = {};

const zipInput = document.getElementById('zipInput');
const dropzone = document.getElementById('dropzone');
const searchInput = document.getElementById('searchInput');
const fileTree = document.getElementById('fileTree');
const previewArea = document.getElementById('previewArea');
const activeFilePath = document.getElementById('activeFilePath');
const activeFileMime = document.getElementById('activeFileMime');
const downloadBtn = document.getElementById('downloadBtn');

// Handle File Selection
if (zipInput) {
  zipInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleZipUpload(e.target.files[0]);
  });
}

// Drag & Drop
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
    if (e.dataTransfer.files.length) handleZipUpload(e.dataTransfer.files[0]);
  });
}

// Search Filter
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    renderTree(allZipFilesMap, e.target.value);
  });
}

// Process ZIP locally in browser
async function handleZipUpload(file) {
  try {
    const zip = new JSZip();
    loadedZip = await zip.loadAsync(file);
    allZipFilesMap = loadedZip.files;

    const fileMeta = document.getElementById('fileMeta');
    if (fileMeta) fileMeta.classList.remove('hidden');

    const metaName = document.getElementById('metaName');
    const metaSize = document.getElementById('metaSize');
    const metaCount = document.getElementById('metaCount');

    if (metaName) metaName.textContent = file.name;
    if (metaSize) metaSize.textContent = formatBytes(file.size);
    if (metaCount) metaCount.textContent = Object.keys(allZipFilesMap).length;

    renderTree(allZipFilesMap);
  } catch (err) {
    alert('Failed to read ZIP file. Make sure it is a valid ZIP archive.');
    console.error(err);
  }
}

// Render File Tree
function renderTree(filesMap, filterTerm = '') {
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

// Preview File Contents
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

      // Check if file is completely empty (e.g., __init__.py)
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

// Download Button
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