# Portfolio

Static, no build step. Vanilla HTML/CSS/JS.

## Before publishing
1. Copy your resume PDF to `assets/Shah_Fahad_Resume.pdf`.
2. Contact form: create a form at https://formspree.io and replace `YOUR_FORM_ID` in `index.html`. Until then, the form opens the visitor's mail app (mailto fallback).

## Local preview
    python3 -m http.server 8000

## GitHub Pages
Push to a repo, then Settings → Pages → Deploy from branch → `main` / root.
For `https://<user>.github.io`, name the repo `<user>.github.io`.
