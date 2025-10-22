# Poor-Notebook Explorer v2 - Offline Version

A poor man Juypyter notebook browser, for online or offline use. 

## Advised usage:

```
git clone git@github.com:aprossi/nbexplorer.git
cd nbexplorer
```
Open the file directly with a browser:

`open index.html` on macos, or `firefox index.html` or alike on linux (
  
Or just click.

In alternative one can locally serve e.g. with `python3 -m http.server 8080` and reach it at `localhost:8080`, or serve wherever one wants.

## Summary of features

* js, css are local (works online or offline, no http server needed)
* preview (not perfect, but ok-ish) of notebooks and scripts, including images (hopefully)
* can load:
  * individual notebooks
  * multiple notebooks
  * directories containining notebooks (and nested directories)
* breadcrumbs for navigation
* live search 
* client-side only

## Static structure

Works both on a web server and just locally opened in a web browser (latter use is advised for more privacy. It is neverhteless client-only, nothing stored server-side)

```
├── index.html                           
├── css/
│   └── highlight-11.9.0-github.min.css # Syntax highlighting theme
├── js/
│   └── highlight-11.9.0.min.js         # Syntax highlighting library
└── README.md                            
```

## Usage

1. Open `index.html` in any modern browser - or at 
2. Drag & drop a folder containing .ipynb and/or .py files
3. Use breadcrumbs to navigate folder structure
4. Toggle "Show Python scripts" to include/exclude .py files
5. Click any file to view it in the modal viewer

## Libraries Used

- highlight.js v11.9.0
- GitHub theme

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

## Caveats

* Rendering is not as pretty as https://nbviewer.org but it kind of does the job.

## Related projects

Not used in current implementation, but relevant existing tools:

* https://github.com/jsvine/nbpreview 

## License 

MIT

