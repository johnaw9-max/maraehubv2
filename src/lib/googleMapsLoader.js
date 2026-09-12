// Loads the Google Maps JavaScript SDK with the Places library, once,
// cached across every caller -- Places Autocomplete needs the live SDK
// (unlike Static Maps, which is just an <img src>), and this is the first
// place in the codebase that loads an external script. Never attempts to
// load without a real key configured, so an unconfigured marae gets the
// honest "not available" message instead of a script that fails to load.
//
// Uses the classic google.maps.places.Autocomplete widget, not the newer
// PlaceAutocompleteElement Google introduced around March 2025 -- simpler,
// well-documented, and still functional as of this writing, but Google has
// been steering new usage toward the newer element. Worth reconfirming
// against Google's current Places API docs before assuming this still
// works, rather than treating this comment as still true indefinitely.

let loadPromise = null;

export function loadGoogleMapsScript() {
  const key = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  if (!key) return Promise.reject(new Error('not_configured'));

  if (window.google?.maps?.places) return Promise.resolve(window.google.maps);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
    script.async = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => { loadPromise = null; reject(new Error('script_load_failed')); };
    document.head.appendChild(script);
  });
  return loadPromise;
}
