# Poor-man Notebook Explorer

A poor-man Jupyter notebook browser, for online or offline use.

Data never leaves your computer. Open DevTools → Network tab → no requests after page load. 

## Advised usage:

```
git clone git@github.com:aprossi/nbexplorer.git
cd nbexplorer
```
Open the file directly with a browser:

`open index.html` on macos, or `firefox index.html` or alike on linux.
  
Or just click.

In alternative one can locally serve e.g. with `python3 -m http.server 8080` and reach it at `localhost:8080`, or serve wherever one wants.

## Summary of features

* **100% client-side** - NO data transmission, ZERO network requests after page load
* js, css are local (works online or offline, no http server needed)
* preview (not perfect, but ok-ish) of notebooks and scripts, including images (hopefully)
* can load:
  * individual notebooks
  * multiple notebooks
  * directories containining notebooks (and nested directories)
* breadcrumbs for navigation
* live search
* keyboard navigation (← → arrow keys in viewer)
* client-side only

## Static structure

Works both on a web server and just locally opened in a web browser (latter use is advised for more privacy. It is neverhteless client-only, nothing stored server-side)

```
├── index.html                              # Main HTML file
├── css/
│   ├── highlight-11.9.0-github.min.css     # Syntax highlighting theme
│   └── nbexplorer.css                       # Application styles
├── js/
│   ├── highlight-11.9.0.min.js             # Syntax highlighting library
│   └── nbexplorer.js                        # Application logic
└── README.md                                
```

## Usage

1. Open `index.html` in any modern browser - or at 
2. Drag & drop a folder containing .ipynb and/or .py files
3. Use breadcrumbs to navigate folder structure
4. Toggle "Show Python scripts" to include/exclude .py files
5. Click any file to view it in the modal viewer
6. Use **← → arrow keys** to navigate between files in the viewer (or click arrows)

## Libraries Used

- [highlight.js v11.9.0](https://highlightjs.org/) (local, no CDN)
- GitHub theme

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

## ZERO DATA TRANSMISSION - Verifiable Privacy

### Verifiable Proof: Data NEVER Leaves Your Computer

This application has **ZERO data transmission**. You can verify this yourself:

#### How to Verify (Browser DevTools):
1. Open browser DevTools (F12 or Cmd+Option+I)
2. Go to **Network** tab
3. Open the application and load your notebooks
4. **Observation**: You will see NO network requests beyond loading the page itself (html, css, js files)
5. **Result**: After the page loads, NO data is transmitted anywhere

#### Code-Level Proof:
- **No fetch() calls**: Search `js/nbexplorer.js` - zero `fetch()` or `XMLHttpRequest` calls
- **No external URLs**: All resources are local files
- **No storage**: No `localStorage`, `sessionStorage`, or `IndexedDB` usage
- **No analytics**: Zero tracking, zero telemetry, zero data collection
- **No web sockets**: No server connections of any kind

#### Privacy summary

* ***No Data Transmission**: All file processing happens locally in your browser. No files, file content, or nor any any other data is ever sent to any server.
* **File Access**: The application only reads files that you explicitly select or drag-and-drop. It never accesses files without your explicit permission. File access is handled using the File System Access API, which only reads files you explicitly select or drag-and-drop. No files are accessed without your permission.
* **File Preview**: File previews are loaded lazily (only when visible) using `IntersectionObserver`, but all processing remains local.
* **No Storage**: Files are kept in browser memory only and are automatically discarded when you refresh the page or click "Clear All". No cookies, localStorage, or IndexedDB are used.
* **XSS Protection**: All file contents are properly escaped before rendering to prevent cross-site scripting vulnerabilities (see `escapeHtml()` function in `js/nbexplorer.js:66-74`).
*  **Open Source**: You can inspect the code yourself in `js/nbexplorer.js` to verify it only reads and displays your files locally.

**For maximum privacy**: Download the repository and open `index.html` directly in your browser. No web server needed - it works with `file://` protocol (or any local server, such as `python3 -m http.server`).

## Caveats

* Rendering is **functional but basic** (not as polished as [nbviewer.org](https://nbviewer.org)).
* Designed for **privacy and simplicity**, not aesthetics.

## Related projects

Not used in current implementation, but relevant existing tools:

* https://github.com/jsvine/nbpreview 

## License 

MIT

