export const EDITOR_BRIDGE_SCRIPT = `
<script id="codeaxys-editor-bridge">
(function() {
  if (window.__codeaxys_editor_initialized) return;
  window.__codeaxys_editor_initialized = true;

  let hoveredEl = null;
  let selectedEl = null;

  let idCounter = 1;
  function assignIds(root) {
    if (!root) return;
    const elements = root.querySelectorAll('*');
    elements.forEach(el => {
      if (!el.hasAttribute('data-codeaxys-id')) {
        el.setAttribute('data-codeaxys-id', 'ca-node-' + idCounter++);
      }
    });
  }

  function notifyReady() {
    try {
      window.parent.postMessage({ type: 'CODEAXYS_CANVAS_READY' }, '*');
    } catch (e) {}
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    notifyReady();
  } else {
    document.addEventListener('DOMContentLoaded', notifyReady);
    window.addEventListener('load', notifyReady);
  }

  assignIds(document.body || document.documentElement);

  const styleEl = document.createElement('style');
  styleEl.textContent = \`
    [data-codeaxys-hover="true"] {
      outline: 2px dashed #a855f7 !important;
      outline-offset: 2px !important;
      cursor: pointer !important;
    }
    [data-codeaxys-selected="true"] {
      outline: 3px solid #7c3aed !important;
      outline-offset: 3px !important;
      box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.3) !important;
    }
  \`;
  document.head.appendChild(styleEl);

  function getElementType(el) {
    if (!el) return 'container';
    const tag = el.tagName.toLowerCase();
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) return 'heading';
    if (tag === 'img') return 'image';
    if (tag === 'a' || tag === 'button' || el.getAttribute('role') === 'button' || el.classList.contains('btn')) return 'button';
    if (['p', 'span', 'b', 'strong', 'em', 'i', 'li', 'td'].includes(tag)) return 'text';
    if (['header', 'footer', 'nav', 'section', 'main', 'article', 'aside'].includes(tag)) return 'section';
    return 'container';
  }

  function serializeNodeData(el) {
    if (!el) return null;
    const computed = window.getComputedStyle(el);
    const tag = el.tagName.toLowerCase();
    const type = getElementType(el);

    return {
      id: el.getAttribute('data-codeaxys-id'),
      tagName: tag,
      type: type,
      textContent: tag === 'img' ? '' : el.innerText,
      innerHTML: el.innerHTML,
      src: tag === 'img' ? (el.getAttribute('src') || '') : '',
      alt: tag === 'img' ? (el.getAttribute('alt') || '') : '',
      href: (tag === 'a' || el.closest('a')) ? (el.getAttribute('href') || el.closest('a')?.getAttribute('href') || '') : '',
      target: (tag === 'a' || el.closest('a')) ? (el.getAttribute('target') || el.closest('a')?.getAttribute('target') || '') : '',
      style: {
        color: computed.color,
        backgroundColor: computed.backgroundColor,
        fontSize: computed.fontSize,
        fontWeight: computed.fontWeight,
        textAlign: computed.textAlign,
        fontFamily: computed.fontFamily,
        lineHeight: computed.lineHeight,
        letterSpacing: computed.letterSpacing,
        padding: computed.padding,
        margin: computed.margin,
        borderRadius: computed.borderRadius,
        border: computed.border,
        width: computed.width,
        height: computed.height,
        objectFit: computed.objectFit,
      }
    };
  }

  document.addEventListener('mouseover', (e) => {
    if (!e.target || e.target === document.body || e.target === document.documentElement) return;
    if (hoveredEl && hoveredEl !== selectedEl) {
      hoveredEl.removeAttribute('data-codeaxys-hover');
    }
    hoveredEl = e.target;
    if (hoveredEl !== selectedEl) {
      hoveredEl.setAttribute('data-codeaxys-hover', 'true');
    }
  }, true);

  document.addEventListener('mouseout', () => {
    if (hoveredEl && hoveredEl !== selectedEl) {
      hoveredEl.removeAttribute('data-codeaxys-hover');
      hoveredEl = null;
    }
  }, true);

  document.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    let target = e.target;
    if (!target || target === document.body || target === document.documentElement) return;

    if (selectedEl) {
      selectedEl.removeAttribute('data-codeaxys-selected');
    }
    selectedEl = target;
    selectedEl.removeAttribute('data-codeaxys-hover');
    selectedEl.setAttribute('data-codeaxys-selected', 'true');

    const data = serializeNodeData(selectedEl);
    window.parent.postMessage({ type: 'CODEAXYS_ELEMENT_SELECTED', data }, '*');
  }, true);

  window.addEventListener('message', (event) => {
    const { type, payload } = event.data || {};
    if (!type || !payload) return;

    const el = payload.id ? document.querySelector(\`[data-codeaxys-id="\${payload.id}"]\`) : selectedEl;
    if (!el) return;

    if (type === 'UPDATE_TEXT') {
      if (payload.textContent !== undefined) {
        el.innerText = payload.textContent;
      }
    } else if (type === 'UPDATE_IMAGE') {
      if (payload.src !== undefined) el.setAttribute('src', payload.src);
      if (payload.alt !== undefined) el.setAttribute('alt', payload.alt);
      if (payload.width) el.style.width = payload.width;
      if (payload.height) el.style.height = payload.height;
      if (payload.borderRadius) el.style.borderRadius = payload.borderRadius;
      if (payload.objectFit) el.style.objectFit = payload.objectFit;
    } else if (type === 'UPDATE_LINK') {
      if (payload.textContent !== undefined) el.innerText = payload.textContent;
      if (payload.href !== undefined) {
        if (el.tagName.toLowerCase() === 'a') el.setAttribute('href', payload.href);
        else {
          const parentA = el.closest('a');
          if (parentA) parentA.setAttribute('href', payload.href);
        }
      }
      if (payload.target !== undefined) {
        if (el.tagName.toLowerCase() === 'a') el.setAttribute('target', payload.target);
        else {
          const parentA = el.closest('a');
          if (parentA) parentA.setAttribute('target', payload.target);
        }
      }
    } else if (type === 'UPDATE_STYLE') {
      if (payload.style) {
        Object.entries(payload.style).forEach(([key, val]) => {
          if (val !== undefined && val !== null) {
            el.style[key] = val;
          }
        });
      }
    } else if (type === 'SELECT_NODE_BY_ID') {
      if (selectedEl) selectedEl.removeAttribute('data-codeaxys-selected');
      selectedEl = el;
      selectedEl.setAttribute('data-codeaxys-selected', 'true');
      const data = serializeNodeData(selectedEl);
      window.parent.postMessage({ type: 'CODEAXYS_ELEMENT_SELECTED', data }, '*');
    }
  });
})();
</script>
`;

export function assemblePreviewDoc(
  html: string = "",
  css: string = "",
  js: string = "",
  isEditMode: boolean = false
): string {
  if (!html) return "";

  const lowerHtml = html.toLowerCase();
  const isFullDoc = lowerHtml.includes("<!doctype") || lowerHtml.includes("<html");

  const editBridge = isEditMode ? EDITOR_BRIDGE_SCRIPT : "";

  if (isFullDoc) {
    let doc = html;

    // Ensure external scripts don't block DOM parsing/ready state
    doc = doc.replace(/<script\b(?![^>]*\b(defer|async)\b)([^>]*\bsrc\s*=\s*[^>]+)>/gi, '<script defer $2>');

    // Inject CSS into <head> if provided and not already present
    if (css && css.trim()) {
      const styleTag = `<style>\n/* CAPTURED STYLES */\n${css}\n</style>`;
      if (doc.includes("</head>")) {
        doc = doc.replace("</head>", `${styleTag}\n</head>`);
      } else if (/<body/i.test(doc)) {
        doc = doc.replace(/<body/i, `${styleTag}\n<body`);
      } else {
        doc = `${styleTag}\n${doc}`;
      }
    }

    // Inject JS & Edit Bridge into </body>
    const scriptContent = `${js ? `<script>\n// FRONTEND INTERACTIVITY\ntry {\n${js}\n} catch (e) { console.error('Preview JS Error:', e); }\n</script>` : ""}\n${editBridge}`;

    if (scriptContent.trim()) {
      if (doc.includes("</body>")) {
        doc = doc.replace("</body>", `${scriptContent}\n</body>`);
      } else {
        doc = `${doc}\n${scriptContent}`;
      }
    }

    return doc;
  }

  // Fragment (Native Codeaxys website sections)
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
${css || ""}
  </style>
</head>
<body>
${html || ""}
  <script>
try {
${js || ""}
} catch (e) { console.error('Preview JS Error:', e); }
  </script>
${editBridge}
</body>
</html>`;
}
