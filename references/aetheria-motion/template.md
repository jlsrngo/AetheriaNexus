# Aetheria Motion Style Prompt Template

To author a new motion style skill for Aetheria Motion Engine, define these sections:

```text
# Style
<English Style Name>

# Output Formats
- Standard Landscape: 1920x1080, 30 fps
- Short-Form Vertical (TikTok / Reels / Shorts): 1080x1920, 30 fps

# Aetheria Single-File HTML Engine Contract
Single-file workspace/index.html exposing window.AETHERIA_FILM, window.renderAt(t), and window.__ready = true, powered by /aetheria-motion.js (window.AM).

# Suggested technical route
<HTML5 2D Canvas / SVG / WebGL / Three.js and key procedural techniques>

# Creative seed
<Beat-by-beat narrative breakdown (Hook -> Escalation -> Climax -> Composed Resolve), exact hex color palette (5-6 colors), typography, and audio sync cues.>

# Signature features and key techniques
- Visual Features: <comma-separated visual hallmarks>
- Key Techniques: <testable motion rules with exact spring/easing parameters, stagger frame counts, and transition mechanics>
```
