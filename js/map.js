/**
 * Service area map: Denver center + ~50 mile radius.
 * Uses Leaflet + OpenStreetMap (no API key). Swap for Google Maps JS if you add a key.
 */
(function () {
  var el = document.getElementById("service-map");
  if (!el || typeof L === "undefined") return;

  var denver = [39.7392, -104.9903];
  var map = L.map(el, {
    scrollWheelZoom: false,
    attributionControl: true,
  }).setView(denver, 8);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  // 50 miles ≈ 80467 m
  var circle = L.circle(denver, {
    radius: 80467,
    color: "#02396b",
    fillColor: "#02396b",
    fillOpacity: 0.12,
    weight: 2,
  }).addTo(map);

  L.marker(denver)
    .addTo(map)
    .bindPopup("Denver — base for mobile detailing");

  map.fitBounds(circle.getBounds(), { padding: [24, 24] });
  map.setZoom(Math.min(map.getZoom() + 0.2, 19));
})();
