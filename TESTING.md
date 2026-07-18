# Map recovery testing

This branch replaces the broken PMTiles map path with a direct OpenFreeMap MapLibre style and removes the mobile canvas override that distorted the WebGL surface.

Before merging, test on iPhone Safari and desktop:

1. The initial view shows the complete world map.
2. Dragging, wheel zoom and pinch zoom work.
3. The plus/minus controls zoom normally.
4. Tapping a country opens the country selection card.
5. A submitted guess receives its heat colour while unguessed countries leave the basemap visible.
6. Reset returns to a complete world view.
7. Expand mode fills the available screen without stretching the map.
8. Light/dark mode rebuilds the matching basemap.
