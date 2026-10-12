# Aryaman Chandra — personal website

A small, framework-free personal site built with HTML, CSS, and JavaScript. Open `index.html` in a browser or publish this folder as a static site.

## Pages

- `index.html` — home, portrait, a recognition carousel, and affiliations
- `about.html` — personal editorial page
- `projects.html` — selected work
- `research.html` — research timeline and paper links
- `blog.html` — research papers and the 17 essays from the original writing archive
- `blog-post-template.html` — narrow layout to duplicate for a long-form note

## Assets and motion

Images and logos live in `assets/images/`. Shared styling is in `assets/css/style.css`; the mobile navigation, animated affiliations strip, paper-opening and scroll-reveal transitions, faint moving mathematical trace, and research-pen cursor with a fading ink stroke are in `assets/js/main.js`. Motion respects reduced-motion preferences; the cursor is disabled on touch devices. Research previews are embedded from the original papers and linked to their sources.

The pages use Google Fonts when online and fall back to system serif and sans-serif fonts. No build step or framework is required.
