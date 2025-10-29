/**
 * Poor-Notebook Explorer - Main JavaScript Module
 * 
 * A client-side only application for browsing Jupyter notebooks (.ipynb) and Python scripts (.py).
 * All file processing happens locally in the user's browser - no data is sent to any server.
 * 
 * Security: This application only reads files locally and never transmits data anywhere.
 * All highlighting, rendering, and display happens entirely in the browser using client-side libraries.
 */

// ============================================================================
// Global State Management
// ============================================================================

/**
 * Map storing card metadata with unique IDs for modal viewing
 * @type {Map<string, {filename: string, raw: string, type: string}>}
 */
const cardMap = new Map();

/**
 * Folder structure tree built from uploaded files
 * @type {Object}
 */
let folderStructure = {};

/**
 * Current navigation path in the folder hierarchy
 * @type {string[]}
 */
let currentPath = [];

/**
 * Whether to show Python .py files in the gallery
 * @type {boolean}
 */
let showPyFiles = true;

/**
 * Current modal navigation state - tracks the active card
 * @type {number}
 */
let currentCardIndex = -1;

/**
 * Array of all available card IDs for navigation
 * @type {string[]}
 */
let navigationCardIds = [];

/**
 * Debug mode flag - set to true to enable console logging for path debugging
 * @type {boolean}
 */
let debugMode = false;

// ============================================================================
// Constants
// ============================================================================

/** Number of notebook cells to show in preview */
const NOTEBOOK_PREVIEW_CELLS = 3;

/** Number of lines to show in Python file preview */
const PYTHON_PREVIEW_LINES = 8;

/** Supported file extensions */
const FILE_EXTENSIONS = {
  IPYNB: 'ipynb',
  PY: 'py'
};

/** File type filters */
const SUPPORTED_EXTENSIONS = ['.ipynb', '.py'];

// ============================================================================
// DOM Element References
// ============================================================================

const dropzone = document.getElementById('dropzone');
const folderInput = document.getElementById('folderInput');
const gallery = document.getElementById('gallery');
const searchbar = document.getElementById('searchbar');
const searchInput = document.getElementById('searchInput');
const breadcrumbs = document.getElementById('breadcrumbs');
const modal = document.getElementById('viewerModal');
const modalClose = document.getElementById('viewerClose');
const viewerTitle = document.getElementById('viewerTitle');
const viewerBody = document.getElementById('viewerBody');
const showPyToggle = document.getElementById('showPyToggle');
const clearBtn = document.getElementById('clearBtn');
const prevButton = document.getElementById('viewerPrev');
const nextButton = document.getElementById('viewerNext');

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Escapes HTML special characters to prevent XSS vulnerabilities
 * SECURITY: Critical for client-side safety - ensures user file contents are safely rendered
 * @param {string} s - The string to escape
 * @returns {string} HTML-escaped string
 */
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[m]));
}

/**
 * Get the current node in the folder structure based on currentPath
 * @returns {Object} The current folder node
 */
function getCurrentNode() {
  let node = folderStructure;
  currentPath.forEach(p => node = node[p]);
  return node;
}

// ============================================================================
// Markdown and Rendering Functions
// ============================================================================

/**
 * Render a simple preview of markdown content
 * SECURITY: Only converts markdown to HTML - does not execute any JavaScript
 * @param {string} text - The markdown text to render
 * @returns {string} HTML representation of the markdown
 */
function renderMarkdown(text) {
  if (!text) return '';
  let html = text.replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>');
  return '<p>' + html + '</p>';
}

/**
 * Render a preview of notebook cells (first 3 cells)
 * @param {Object} nb - The notebook object parsed from JSON
 * @returns {string} HTML preview of the notebook
 */
function renderNotebookPreview(nb) {
  const cells = nb.cells || [];
  let html = '';
  let shown = 0;
  for (const c of cells) {
    if (shown >= NOTEBOOK_PREVIEW_CELLS) break;
    if (c.cell_type === 'markdown') {
      html += renderMarkdown(Array.isArray(c.source) ? c.source.join('') : c.source);
      shown++;
    } else if (c.cell_type === 'code') {
      const src = (Array.isArray(c.source) ? c.source.join('') : c.source) || '';
      html += `<pre><code class="language-python">${escapeHtml(src.trim())}</code></pre>`;
      shown++;
    }
  }
  return html;
}

/**
 * Highlight code blocks in a specific container element
 * SECURITY: Uses highlight.js which sanitizes output - no code execution
 * @param {HTMLElement} container - The container element to highlight code within
 */
function highlightCodeInContainer(container) {
  if (window.hljs) {
    // Highlight all code blocks within the container
    const codeBlocks = container.querySelectorAll('pre code');
    codeBlocks.forEach(block => {
      hljs.highlightElement(block);
    });
  }
}

/**
 * Render the full notebook for modal viewing
 * @param {Object} nb - The complete notebook object
 * @returns {string} HTML representation of the full notebook
 */
function renderFullNotebook(nb) {
  let html = '';
  (nb.cells || []).forEach(c => {
    html += `<div class="viewer-cell ${c.cell_type}">`;

    if (c.cell_type === 'markdown') {
      html += renderMarkdown(Array.isArray(c.source) ? c.source.join('') : c.source);
    } else if (c.cell_type === 'code') {
      const src = (Array.isArray(c.source) ? c.source.join('') : c.source) || '';
      html += `<pre><code class="language-python">${escapeHtml(src)}</code></pre>`;

      // Render outputs
      (c.outputs || []).forEach(o => {
        if (debugMode) {
          console.log('Output:', o);
        }

        // Prioritize image data over text
        if (o.data && o.data['image/png']) {
          html += `<img src="data:image/png;base64,${o.data['image/png']}" style="max-width:100%;">`;
        } else if (o.data && o.data['image/jpeg']) {
          html += `<img src="data:image/jpeg;base64,${o.data['image/jpeg']}" style="max-width:100%;">`;
        } else if (o.data && o.data['image/svg+xml']) {
          html += `<img src="data:image/svg+xml;base64,${o.data['image/svg+xml']}" style="max-width:100%;">`;
        } else if (o.data && o.data['text/plain']) {
          const text = Array.isArray(o.data['text/plain']) ? o.data['text/plain'].join('') : o.data['text/plain'];
          // Skip matplotlib figure text representations
          if (!text.includes('<Figure size') && !text.includes('Figure(')) {
            html += `<pre class="out">${escapeHtml(text)}</pre>`;
          }
        } else if (o.output_type === 'stream' && o.text) {
          const text = Array.isArray(o.text) ? o.text.join('') : o.text;
          html += `<pre class="out">${escapeHtml(text)}</pre>`;
        }
      });
    }

    html += '</div>';
  });
  return html;
}

// ============================================================================
// File Tree and Gallery Functions
// ============================================================================

/**
 * Recursively traverse the file tree from drop/add events
 * SECURITY: Only reads files locally - never transmits data
 * @param {FileSystemEntry} item - The file system entry to traverse
 * @param {File[]} fileList - Array to accumulate files
 * @param {string} path - Current path for fullPath construction
 * @returns {Promise} Promise that resolves when traversal is complete
 */
async function traverseFileTree(item, fileList, path = "") {
  return new Promise(resolve => {
    if (item.isFile) {
      item.file(f => {
        // Normalize path: ensure forward slashes for cross-platform compatibility
        const normalizedPath = path.replace(/\\/g, '/');
        f.fullPath = normalizedPath + f.name;
        
        if (debugMode) {
          console.log('[traverseFileTree] File:', f.name, 'Path:', path, 'FullPath:', f.fullPath);
        }
        
        if ((f.name.endsWith('.ipynb') || f.name.endsWith('.py')) && !f.name.startsWith('._')) {
          fileList.push(f);
        }
        resolve();
      });
    } else if (item.isDirectory) {
      const dirReader = item.createReader();
      dirReader.readEntries(async entries => {
        for (const entry of entries) {
          // Skip macOS metadata directories
          if (!entry.name.startsWith('._')) {
            // Normalize path: ensure forward slashes for cross-platform compatibility
            const normalizedPath = path.replace(/\\/g, '/');
            const newPath = normalizedPath + item.name + "/";
            
            if (debugMode) {
              console.log('[traverseFileTree] Directory:', item.name, 'Path:', path, 'NewPath:', newPath);
            }
            
            await traverseFileTree(entry, fileList, newPath);
          }
        }
        resolve();
      });
    } else resolve();
  });
}

/**
 * Normalize file path to ensure cross-platform compatibility
 * Handles both webkitRelativePath (from file input) and fullPath (from drag-drop)
 * Normalizes Windows backslashes to forward slashes
 * @param {File} file - The file object to normalize
 * @returns {string} Normalized path
 */
function normalizeFilePath(file) {
  // Try webkitRelativePath first (from file input with webkitdirectory)
  // Then fall back to fullPath (from drag-and-drop)
  let path = file.webkitRelativePath || file.fullPath || '';
  
  // If no path is available, use just the filename (file at root level)
  if (!path) {
    return file.name;
  }
  
  // Normalize Windows paths: replace all backslashes with forward slashes
  // Handle both single and double backslashes (some Windows APIs return double)
  const normalized = path.replace(/\\\\+/g, '/').replace(/\\/g, '/');
  
  if (debugMode) {
    console.log('[normalizeFilePath] File:', file.name);
    console.log('[normalizeFilePath] webkitRelativePath:', file.webkitRelativePath);
    console.log('[normalizeFilePath] fullPath:', file.fullPath);
    console.log('[normalizeFilePath] Normalized:', normalized);
  }
  
  return normalized;
}

/**
 * Build a nested tree structure from file array based on normalized paths
 * @param {File[]} files - Array of files (may have webkitRelativePath or fullPath)
 * @returns {Object} Nested tree structure representing the folder hierarchy
 */
function buildTree(files) {
  const tree = {};
  for (const f of files) {
    // Normalize the path (handles both webkitRelativePath and fullPath)
    // Always set fullPath to normalized version for consistency
    const normalized = normalizeFilePath(f);
    f.fullPath = normalized;
    
    // Split into parts and remove empty segments
    const parts = normalized.split('/').filter(Boolean);
    
    if (debugMode) {
      console.log('[buildTree] File:', f.name);
      console.log('[buildTree] Normalized path:', normalized);
      console.log('[buildTree] Path parts:', parts);
    }
    
    let node = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        // Last part is the filename - add to files array
        if (!node.files) node.files = [];
        node.files.push(f);
      } else {
        // Intermediate part is a folder name
        node[part] = node[part] || {};
        node = node[part];
      }
    }
  }
  
  if (debugMode) {
    console.log('[buildTree] Final tree structure:', tree);
  }
  
  return tree;
}

/**
 * Initialize the gallery with uploaded files
 * @param {FileList} files - The files to display in the gallery
 */
function initGallery(files) {
  const supportedFiles = Array.from(files).filter(f => 
    SUPPORTED_EXTENSIONS.some(ext => f.name.endsWith(ext)) && !f.name.startsWith('._')
  );
  if (!supportedFiles.length) {
    alert("No .ipynb or .py files found.");
    return;
  }
  
  if (debugMode) {
    console.log('[initGallery] Processing', supportedFiles.length, 'files');
    supportedFiles.forEach(f => {
      console.log('[initGallery] File:', f.name, 'webkitRelativePath:', f.webkitRelativePath, 'fullPath:', f.fullPath);
    });
  }
  
  folderStructure = buildTree(supportedFiles);
  currentPath = [];
  renderFolderView(folderStructure);
  dropzone.style.display = 'none';
  searchbar.style.display = 'block';
  breadcrumbs.style.display = 'block';
}

/**
 * Render the current folder view with subfolders and files
 * @param {Object} node - The current folder node to render
 */
function renderFolderView(node) {
  gallery.innerHTML = '';
  updateBreadcrumbs();

  // Render folders first
  for (const [name, val] of Object.entries(node)) {
    if (name !== 'files' && !name.startsWith('._')) {
      const card = document.createElement('div');
      card.className = 'card folder';
      card.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 7h5l2 3h11a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1V7z"/></svg>' + name;
      card.onclick = () => {
        currentPath.push(name);
        renderFolderView(node[name]);
      };
      gallery.appendChild(card);
    }
  }

  // Render files
  if (node.files) {
    node.files.forEach(file => {
      const ext = file.name.endsWith('.py') ? FILE_EXTENSIONS.PY : FILE_EXTENSIONS.IPYNB;
      if (!showPyFiles && ext === FILE_EXTENSIONS.PY) return;

      const card = document.createElement('div');
      card.className = `card ${ext}`;
      const header = document.createElement('div');
      header.className = 'card-header';
      header.textContent = file.name;
      const content = document.createElement('div');
      content.className = 'card-content';
      card.appendChild(header);
      card.appendChild(content);
      gallery.appendChild(card);

      // Use IntersectionObserver for lazy loading file content
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            obs.disconnect();
            const reader = new FileReader();
            reader.onload = e => {
              try {
                if (ext === FILE_EXTENSIONS.IPYNB) {
                  const nb = JSON.parse(e.target.result);
                  const html = renderNotebookPreview(nb);
                  content.innerHTML = html;
                  // Highlight code after DOM update
                  highlightCodeInContainer(content);
                } else {
                  // Render Python file preview
                  const code = e.target.result.split('\n').slice(0, PYTHON_PREVIEW_LINES).join('\n');
                  content.innerHTML = `<pre><code class="language-python">${escapeHtml(code)}</code></pre>`;
                  // Highlight code after DOM update
                  highlightCodeInContainer(content);
                }
                const id = Math.random().toString(36).slice(2);
                card.dataset.cardId = id; // Store ID for navigation
                cardMap.set(id, { filename: file.name, raw: e.target.result, type: ext });
                card.onclick = () => openNotebookModal(id);
              } catch (err) {
                content.textContent = 'Error parsing';
              }
            };
            reader.readAsText(file);
          }
        });
      });
      observer.observe(card);
    });
  }
}

// ============================================================================
// Breadcrumb Navigation
// ============================================================================

/**
 * Update the breadcrumb trail based on currentPath
 */
function updateBreadcrumbs() {
  breadcrumbs.innerHTML = '';
  const root = document.createElement('span');
  root.textContent = '🏠 root';
  root.className = 'breadcrumb-item';
  root.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    currentPath = [];
    renderFolderView(folderStructure);
  };
  breadcrumbs.appendChild(root);
  
  currentPath.forEach((seg, i) => {
    const arrow = document.createTextNode(' → ');
    breadcrumbs.appendChild(arrow);
    
    const span = document.createElement('span');
    span.className = 'breadcrumb-item';
    span.textContent = seg;
    span.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentPath = currentPath.slice(0, i + 1);
      let node = folderStructure;
      for (const p of currentPath) {
        if (node && node[p]) {
          node = node[p];
        } else {
          console.warn('Path segment not found:', p, 'in path:', currentPath);
          // Fall back to root if path is invalid
          currentPath = [];
          node = folderStructure;
          break;
        }
      }
      renderFolderView(node);
    };
    breadcrumbs.appendChild(span);
  });
}

// ============================================================================
// Modal Viewer Functions
// ============================================================================

/**
 * Close the modal viewer and reset navigation state
 */
function closeModal() {
  modal.style.display = 'none';
  viewerBody.innerHTML = '';
  currentCardIndex = -1;
  navigationCardIds = [];
}

/**
 * Get all available card IDs from the current gallery view
 * @returns {string[]} Array of card IDs in the current view
 */
function getAllCardIds() {
  const cardIds = [];
  gallery.querySelectorAll('.card').forEach(card => {
    // Get card ID from onclick handler (stored in the card element)
    if (card.dataset.cardId) {
      cardIds.push(card.dataset.cardId);
    }
  });
  return cardIds;
}

/**
 * Open the modal viewer for a specific file
 * @param {string} cardId - The unique ID of the card to display
 */
function openNotebookModal(cardId) {
  const meta = cardMap.get(cardId);
  if (!meta) return;

  // Get all card IDs for navigation
  navigationCardIds = getAllCardIds();
  currentCardIndex = navigationCardIds.indexOf(cardId);

  loadNotebookInModal(meta);
  updateNavigationButtons();

  modal.style.display = 'block';
  
  // Scroll to top
  modal.scrollTop = 0;
}

/**
 * Load notebook content into the modal
 * @param {Object} meta - The file metadata
 */
function loadNotebookInModal(meta) {
  viewerTitle.textContent = meta.filename;

  if (meta.type === FILE_EXTENSIONS.PY) {
    viewerBody.innerHTML = `<pre><code class="language-python">${escapeHtml(meta.raw)}</code></pre>`;
    highlightCodeInContainer(viewerBody);
  } else {
    let nb;
    try {
      nb = JSON.parse(meta.raw);
    } catch (err) {
      alert('Parse error');
      return;
    }
    viewerBody.innerHTML = renderFullNotebook(nb);
    highlightCodeInContainer(viewerBody);
  }
}

/**
 * Navigate to the previous file in the gallery
 */
function navigatePrevious() {
  if (currentCardIndex > 0 && !prevButton.disabled) {
    currentCardIndex--;
    const cardId = navigationCardIds[currentCardIndex];
    const meta = cardMap.get(cardId);
    if (meta) {
      loadNotebookInModal(meta);
      updateNavigationButtons();
      modal.scrollTop = 0;
    }
  }
}

/**
 * Navigate to the next file in the gallery
 */
function navigateNext() {
  if (currentCardIndex < navigationCardIds.length - 1 && !nextButton.disabled) {
    currentCardIndex++;
    const cardId = navigationCardIds[currentCardIndex];
    const meta = cardMap.get(cardId);
    if (meta) {
      loadNotebookInModal(meta);
      updateNavigationButtons();
      modal.scrollTop = 0;
    }
  }
}

/**
 * Update navigation button state based on current position
 */
function updateNavigationButtons() {
  if (prevButton && nextButton) {
    const hasPrev = currentCardIndex > 0;
    const hasNext = currentCardIndex < navigationCardIds.length - 1;
    
    prevButton.disabled = !hasPrev;
    prevButton.classList.toggle('disabled', !hasPrev);
    
    nextButton.disabled = !hasNext;
    nextButton.classList.toggle('disabled', !hasNext);
  }
}

// ============================================================================
// Event Listeners Setup
// ============================================================================

/**
 * Initialize all event listeners for drag-and-drop, file selection, and UI interactions
 */
function initEventListeners() {
  // Dropzone click to trigger file input
  dropzone.addEventListener('click', () => folderInput.click());

  // Drag and drop event handlers
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eName => {
    dropzone.addEventListener(eName, e => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  // Visual feedback on drag
  ['dragenter', 'dragover'].forEach(eName => {
    dropzone.addEventListener(eName, () => dropzone.classList.add('dragover'));
  });

  ['dragleave', 'drop'].forEach(eName => {
    dropzone.addEventListener(eName, () => dropzone.classList.remove('dragover'));
  });

  // Handle file drop
  dropzone.addEventListener('drop', async e => {
    const items = e.dataTransfer.items;
    if (items && items.length) {
      const files = [];
      for (const item of items) {
        const entry = item.webkitGetAsEntry && item.webkitGetAsEntry();
        if (entry) await traverseFileTree(entry, files);
      }
      initGallery(files);
    } else initGallery(e.dataTransfer.files);
  });

  // Handle file input change
  folderInput.addEventListener('change', e => initGallery(e.target.files));

  // Search functionality
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase();
    [...gallery.children].forEach(c => {
      const t = c.textContent.toLowerCase();
      c.style.display = t.includes(q) ? 'block' : 'none';
    });
  });

  // Python files toggle - sync initial state
  showPyFiles = showPyToggle.checked;
  showPyToggle.addEventListener('change', e => {
    showPyFiles = e.target.checked;
    renderFolderView(getCurrentNode());
  });

  // Clear button
  clearBtn.addEventListener('click', () => {
    folderStructure = {};
    currentPath = [];
    cardMap.clear();
    gallery.innerHTML = '';
    breadcrumbs.style.display = 'none';
    searchbar.style.display = 'none';
    dropzone.style.display = 'block';
  });

  // Modal close handlers
  modalClose.onclick = closeModal;

  window.onclick = e => {
    if (e.target === modal) {
      closeModal();
    }
  };

  // Keyboard navigation for modal
  document.addEventListener('keydown', e => {
    if (modal.style.display === 'block') {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigatePrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateNext();
      } else if (e.key === 'Escape') {
        closeModal();
      }
    }
  });

  // Navigation button handlers
  if (prevButton) {
    prevButton.addEventListener('click', e => {
      e.stopPropagation();
      navigatePrevious();
    });
  }

  if (nextButton) {
    nextButton.addEventListener('click', e => {
      e.stopPropagation();
      navigateNext();
    });
  }
}

// ============================================================================
// Testing and Debugging Functions
// ============================================================================

/**
 * Test function to simulate Windows path handling
 * Call this from browser console: testWindowsPaths()
 * This creates mock File objects with Windows-style backslash paths
 */
window.testWindowsPaths = function() {
  debugMode = true;
  console.log('=== Testing Windows Path Normalization ===');
  
  // Create mock File objects with Windows-style paths
  const mockFiles = [
    { name: 'notebook1.ipynb', fullPath: 'C:\\Users\\Test\\folder1\\notebook1.ipynb' },
    { name: 'script1.py', fullPath: 'C:\\Users\\Test\\folder1\\script1.py' },
    { name: 'notebook2.ipynb', fullPath: 'C:\\Users\\Test\\folder2\\subfolder\\notebook2.ipynb' },
    { name: 'script2.py', fullPath: 'C:\\Users\\Test\\script2.py' },
    // Test mixed paths
    { name: 'mixed.ipynb', fullPath: 'folder1\\subfolder\\mixed.ipynb' },
    // Test double backslashes (sometimes Windows APIs return these)
    { name: 'double.ipynb', fullPath: 'C:\\\\Users\\\\Test\\\\double.ipynb' },
    // Test webkitRelativePath (from file input)
    { name: 'webkit.ipynb', webkitRelativePath: 'folder1\\subfolder\\webkit.ipynb' },
  ];
  
  console.log('\n--- Input files with Windows paths ---');
  mockFiles.forEach(f => {
    console.log(`${f.name}: fullPath=${f.fullPath}, webkitRelativePath=${f.webkitRelativePath}`);
  });
  
  // Test the buildTree function
  console.log('\n--- Testing buildTree function ---');
  const tree = buildTree(mockFiles);
  
  console.log('\n--- Verification ---');
  console.log('Tree structure:', JSON.stringify(tree, null, 2));
  
  // Verify files are in correct locations
  function verifyTree(node, path = '') {
    if (node.files) {
      console.log(`✓ Files found at ${path || 'root'}:`, node.files.map(f => f.name).join(', '));
    }
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'files') {
        verifyTree(value, path ? `${path}/${key}` : key);
      }
    }
  }
  
  verifyTree(tree);
  
  console.log('\n=== Test Complete ===');
  console.log('Enable debug mode permanently? Run: debugMode = true');
  debugMode = false;
};

/**
 * Test function to simulate Mac/Linux path handling
 * Call this from browser console: testMacPaths()
 * This creates mock File objects with Unix-style forward slash paths
 */
window.testMacPaths = function() {
  debugMode = true;
  console.log('=== Testing Mac/Linux Path Normalization ===');
  
  // Create mock File objects with Unix-style paths
  const mockFiles = [
    { name: 'notebook1.ipynb', fullPath: '/Users/Test/folder1/notebook1.ipynb' },
    { name: 'script1.py', fullPath: '/Users/Test/folder1/script1.py' },
    { name: 'notebook2.ipynb', fullPath: '/Users/Test/folder2/subfolder/notebook2.ipynb' },
    { name: 'script2.py', fullPath: '/Users/Test/script2.py' },
    // Test relative paths (from file input)
    { name: 'relative.ipynb', webkitRelativePath: 'folder1/subfolder/relative.ipynb' },
    // Test paths without leading slash
    { name: 'noSlash.ipynb', fullPath: 'folder1/subfolder/noSlash.ipynb' },
  ];
  
  console.log('\n--- Input files with Unix paths ---');
  mockFiles.forEach(f => {
    console.log(`${f.name}: fullPath=${f.fullPath}, webkitRelativePath=${f.webkitRelativePath}`);
  });
  
  // Test the buildTree function
  console.log('\n--- Testing buildTree function ---');
  const tree = buildTree(mockFiles);
  
  console.log('\n--- Verification ---');
  console.log('Tree structure:', JSON.stringify(tree, null, 2));
  
  // Verify files are in correct locations
  function verifyTree(node, path = '') {
    if (node.files) {
      console.log(`✓ Files found at ${path || 'root'}:`, node.files.map(f => f.name).join(', '));
    }
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'files') {
        verifyTree(value, path ? `${path}/${key}` : key);
      }
    }
  }
  
  verifyTree(tree);
  
  console.log('\n=== Test Complete ===');
  console.log('Enable debug mode permanently? Run: debugMode = true');
  debugMode = false;
};

/**
 * Test both Windows and Mac paths together
 * Call this from browser console: testCrossPlatform()
 */
window.testCrossPlatform = function() {
  debugMode = true;
  console.log('=== Testing Cross-Platform Path Handling ===');
  
  const mockFiles = [
    // Windows paths with fullPath
    { name: 'win1.ipynb', fullPath: 'C:\\Users\\Test\\folder1\\win1.ipynb' },
    // Mac paths with fullPath
    { name: 'mac1.ipynb', fullPath: '/Users/Test/folder1/mac1.ipynb' },
    // Windows paths with webkitRelativePath
    { name: 'win2.ipynb', webkitRelativePath: 'folder1\\subfolder\\win2.ipynb' },
    // Mac paths with webkitRelativePath
    { name: 'mac2.ipynb', webkitRelativePath: 'folder1/subfolder/mac2.ipynb' },
  ];
  
  console.log('\n--- Mixed platform files ---');
  mockFiles.forEach(f => {
    console.log(`${f.name}: fullPath=${f.fullPath}, webkitRelativePath=${f.webkitRelativePath}`);
  });
  
  const tree = buildTree(mockFiles);
  
  console.log('\n--- Tree structure ---');
  console.log(JSON.stringify(tree, null, 2));
  
  console.log('\n=== Test Complete ===');
  debugMode = false;
};

/**
 * Enable debug logging for path operations
 * Call from browser console: enablePathDebug()
 */
window.enablePathDebug = function() {
  debugMode = true;
  console.log('Path debug mode enabled. Reload files to see debug output.');
};

/**
 * Disable debug logging
 * Call from browser console: disablePathDebug()
 */
window.disablePathDebug = function() {
  debugMode = false;
  console.log('Path debug mode disabled.');
};

// ============================================================================
// Application Initialization
// ============================================================================

// Initialize the application
initEventListeners();

