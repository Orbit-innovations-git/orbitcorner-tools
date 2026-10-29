/**
 * OrbitCorner Tools: shared code for every page with a tool.
 *
 * The first time a visitor changes an input in a tool, sends one anonymous "tool_used" event
 * to the site's own analytics, if the page has any: gtag('event', 'tool_used', { tool_name })
 * when window.gtag exists, otherwise a { event: 'tool_used', tool_name } push to
 * window.dataLayer. Only the shortcode name is sent, never what the visitor typed. At most
 * once per page view, nothing at all under Do Not Track, and errors never reach the tools.
 */
(function () {
  'use strict';

  if (navigator.doNotTrack === '1') {
    return;
  }

  // The shortcode name from the nearest [data-oc-tool] container, or '' outside a tool.
  function toolName(el) {
    while (el && el.getAttribute) {
      var name = el.getAttribute('data-oc-tool');
      if (name) {
        return /^[a-z0-9_-]{1,40}$/.test(name) ? name : '';
      }
      el = el.parentNode;
    }
    return '';
  }

  function used(e) {
    try {
      var name = e.isTrusted === false ? '' : toolName(e.target);
      if (!name) {
        return;
      }
      document.removeEventListener('input', used, true);
      document.removeEventListener('change', used, true);
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'tool_used', { tool_name: name });
      } else if (window.dataLayer && typeof window.dataLayer.push === 'function') {
        window.dataLayer.push({ event: 'tool_used', tool_name: name });
      }
    } catch (err) {
      // A broken analytics tag must never break a tool.
    }
  }

  // Capture phase, so a tool that stops an event can't hide it.
  document.addEventListener('input', used, true);
  document.addEventListener('change', used, true);
}());
