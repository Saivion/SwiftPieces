// Hides a closed or expired announcement bar before the page paints (components/announce/promo-boot.tsx).
// It loads as a blocking script just ahead of the navbar, reads the bar's localStorage key and end time
// from its own data attributes, and adds `promo-off` to <html>, which hides the bar and zeroes --promo-h
// (app/globals.css), so the navbar and its spacer never jump.
(function () {
  try {
    var data = document.currentScript.dataset;
    var end = Number(data.ends || 0);
    if (localStorage.getItem(data.key) === "1" || (end && Date.now() >= end)) {
      document.documentElement.classList.add("promo-off");
    }
  } catch (e) {}
})();
