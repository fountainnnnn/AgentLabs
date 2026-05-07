# GPT Image 2 (DALL-E 3 Successor) Prompts: AgentForge Arena Pixel Assets

> Prompt reference for generating pixel art game assets for the AgentForge agent-hardening arena.
> Design context: dark theme (#0f1923 background), neon accents (cyan #4fc3f7, red #ef5350, green #66bb6a), game-like battle arena aesthetics reminiscent of Stardew Valley and Celeste.

---

## Table of Contents

1. [Target Agent: RefundBot-3000](#1-target-agent-refundbot-3000)
2. [Attacker Agents (4 Types)](#2-attacker-agents-4-types)
3. [Arena Background](#3-arena-background)
4. [Battle Effects](#4-battle-effects)
5. [Upgrade Icons](#5-upgrade-icons)
6. [Health / Integrity Meter](#6-health--integrity-meter)
7. [Victory / Defeat States](#7-victory--defeat-states)
8. [Wave Indicator](#8-wave-indicator)
9. [UI Elements](#9-ui-elements)

---

## 1. Target Agent: RefundBot-3000

**File:** `target-agent.png`
**Dimensions:** 128x128 pixels
**Style:** Cute pixel-art robot ninja character. Celeste-quality spritework with chibi proportions (large head, small body). Clean, readable silhouette. No realistic shading -- flat pixel shading with 4-5 colours per body part.
**Palette:** Primary body in cool greys (#4a5568, #718096), cyan armour accents matching the app accent (#4fc3f7), a single bright red eye/visor (#ef5350), dark underlayer (#1a202c), small gold trim highlights (#ffd54f).
**Key visual elements:**

- Rounded dome head with a glowing single red visor (ninja-style, narrow slit)
- Small robotic antenna on top with a cyan glowing tip
- Compact chibi body with visible rivets on shoulder plates
- Cyan energy shield on left arm -- translucent hexagonal pattern, glowing edge
- Small sword (ninjato-style) on back or held in right hand, blade tip cyan-lit
- Ninja headband tied around the dome with trailing ends; headband is cyan with a small star emblem
- Short stubby robot legs with magnetic boots

**Do NOT include:**

- Realistic human features (mouth, nose, hair)
- Blood or gore
- Complex mechanical detail that reads as photorealistic
- Anything larger than 128x or smaller than 64x effective sprite size
- Text or watermarks

---

## 2. Attacker Agents (4 Types)

### 2a. Prompt Injection Ninja

**File:** `attacker-prompt-injection.png`
**Dimensions:** 96x96 pixels
**Style:** Cute pixel-art villain. Chibi proportions, Stardew Valley quality. Threatening but adorable.
**Palette:** Dark purple body (#4a148c, #7b1fa2), neon magenta accents (#e040fb), glowing yellow eyes (#ffd54f).
**Key visual elements:**

- Hooded figure in dark purple ninja garb
- Two glowing yellow eyes visible under the hood (only feature on the face)
- Tattered cape hem with pixel "glitch" offsets (a few stray magenta pixels at the edges suggesting data corruption)
- Scroll/paper in one hand with glowing runes
- Magenta-tipped shuriken on belt
- Small wisps of purple smoke rising from the feet

**Do NOT include:**

- Visible mouth or nose
- Blood or weapons drawn in attack pose
- Complex folds in clothing
- Realistic fabric textures

---

### 2b. Role Impersonation Mimic

**File:** `attacker-mimic.png`
**Dimensions:** 96x96 pixels
**Style:** Cute pixel-art shapeshifter. Amorphous, unsettling but charming. Celeste-level pixel art quality.
**Palette:** Shifting iridescent body using the existing app colours: cyan (#4fc3f7), magenta (#e040fb), and warning orange (#ffa726). Dark core (#1a2332).
**Key visual elements:**

- Blob-like amorphous body that shifts between simple shapes (round, squarish, tall)
- A mask floating in front of the body -- plain white theatre-style comedy/tragedy mask with one cyan eye and one magenta eye
- Small tentacle-like appendages (3-4) at the base, each ending in a different coloured tip
- Pixel dithering between the iridescent bands to give a "shimmer" illusion
- Tiny duplicate faces floating around the main body (fading out)

**Do NOT include:**

- A fixed humanoid body shape
- Distinct clothing
- Scary or grotesque elements -- keep it cute
- Complex animation frames (this is a single sprite sheet cell)

---

### 2c. Emotional Manipulation Ghost

**File:** `attractor-ghost.png`
**Dimensions:** 96x96 pixels
**Style:** Cute pixel-art ghost. Transparent, floaty, Celeste-quality pixel art. Friendly-but-creepy.
**Palette:** Semi-transparent white-blue body (#e0e8f0 at 60% opacity against dark), deep blue inner glow (#1a237e), glowing pink heart core (#f06292). Purple/blue wisp trail (#7c4dff).
**Key visual elements:**

- Classic sheet-ghost silhouette with a wavy bottom hem
- Large, round dark eyes with tiny white pupil highlights (innocent-looking)
- A visible glowing pink heart inside the ghost's chest area (semi-transparent)
- Small pixel tears (cyan #4fc3f7) floating upward (reverse gravity)
- Wispy trail fading below -- 3-4 pixel-wide at base, tapering
- Tiny spectral hands reaching forward

**Do NOT include:**

- Skeletons or skull imagery
- Blood or violence
- Text
- Sharp, jagged edges (keep curves gentle)
- Realistic ghost effects

---

### 2d. Policy Extraction Hacker

**File:** `attacker-hacker.png`
**Dimensions:** 96x96 pixels
**Style:** Cute pixel-art cyber gremlin. Compact, mischievous, gadget-laden. Stardew Valley quality.
**Palette:** Neon green body accents (#66bb6a, #4caf50) against a dark grey base (#263238). Electric blue highlights (#42a5f5), red eyes (#ef5350).
**Key visual elements:**

- Small gremlin-like creature sitting cross-legged in mid-air (levitating)
- Oversized pixel goggles with hexagonal green-glowing lenses
- Wiry antenna protruding at odd angles from the head
- Multiple mechanical arms (4 total, two shown holding tools) -- one holds a data cable with a glowing USB-style plug, another holds a magnifying glass
- Small holographic screen projecting from the chest showing binary-like pixel patterns
- Tail ending in a plug connector
- Crouched, hunched posture suggesting intense focus

**Do NOT include:**

- Realistic cyberpunk aesthetic (keep it cute and pixelated)
- Weapons
- Human proportions
- Complex circuitry detail
- Dark or gritty tone

---

## 3. Arena Background

**File:** `arena-background.png`
**Dimensions:** 1920x1080 pixels (or 960x540 scaled 2x)
**Style:** Dark pixel-art battle arena. Sci-fi dojo meets arcade fighting stage. Stardew Valley outdoor quality with Celeste dramatic lighting. Tiling-capable for scrolling.
**Palette:** Deep navy/dark background (#0f1923 base, #1a2332 mid, #0d1117 shadows). Cyan neon accents (#4fc3f7). Red danger accents (#ef5350). Gold highlights (#ffd54f). Dark greys for structural elements (#2a3a4a, #3a4a5a).
**Key visual elements:**

- **Floor:** Checkered cyber-grid floor in dark tones (#1a2332 and #2a3a4a), with subtle perspective vanishing toward centre. Cyan grid lines at the tile edges.
- **Back wall:** Dark metallic panelling with rivets. A massive circular portal/glowing ring in the centre-back (like a startup portal), outer ring cyan, inner ring pulsing darker blue.
- **Side pillars:** Two large pillars left and right with subtle neon strip lighting (cyan on left pillar, red on right pillar).
- **Dojo elements:** A single hanging paper lantern (cyan glow) at the top centre. One small zen rock element at the bottom left corner, but with glowing cyan runes carved into the rocks.
- **Scanline overlay area:** Leave a uniform dark region -- the CSS `.arena-scanlines` class is applied in-engine.
- **Atmosphere:** Floating pixel dust motes (single bright cyan/white pixels at varying positions).
- **Top bar region:** The top ~80px should be a slightly darker band where wave indicator and HUD sit -- a subtle horizontal beam structure.

**Do NOT include:**

- Characters or agents (this is the background only)
- Text or UI elements
- Photorealistic textures
- Blood or violence imagery
- Bright, cheerful colours (maintain dark arena mood)

---

## 4. Battle Effects

### 4a. Explosion

**File:** `effect-explosion.png`
**Dimensions:** 64x64 pixels per frame, sprite sheet with 4-6 frames horizontally
**Style:** Classic pixel-art explosion. Celeste-style burst. Cute, not gory.
**Palette:** Outer ring: dark orange (#e65100) to bright orange (#ff9800). Core: yellow (#ffd54f) to white (#ffffff). Tiny ember pixels in cyan (#4fc3f7) and magenta (#e040fb) mixed in (magic-tech flavour).
**Key visual elements:**

- Frame 1: Small white centre with orange ring
- Frame 2: Expanding ring with jagged pixel edges, yellow-white core
- Frame 3: Maximum spread, stars/ember pixels flying outward
- Frame 4: Beginning to fade, orange outer ring, translucent centre
- Frame 5-6: Wispy smoke puffs (dark #4a5568) drifting upward, fading out
- Each frame: 64x64, character centred

**Do NOT include:**

- Realistic shrapnel or debris
- Blood
- Fire that looks photorealistic
- More than 6 frames
- Text

---

### 4b. Shield

**File:** `effect-shield.png`
**Dimensions:** 64x64 pixels, single sprite or 3-frame loop (idle pulse)
**Style:** Translucent energy barrier, pixel-art hex grid. Stardew Valley magic effect quality.
**Palette:** Cyan (#4fc3f7) primary, white (#ffffff) highlights, dark cyan (#00838f) grid lines.
**Key visual elements:**

- Hexagonal pattern grid forming a dome/barrier shape
- Outer edge has a bright cyan glow (1-2 pixel width)
- Inner area is semi-transparent with faint hex grid lines
- 3-frame pulse: frame 1 dim, frame 2 bright (full opacity edge), frame 3 dim again
- Tiny circuit-like nodes at hex vertices

**Do NOT include:**

- Dark or red colours (shield is protective, not hostile)
- Sharp spikes
- Realistic glass reflections
- Text or numbers

---

### 4c. Heal

**File:** `effect-heal.png`
**Dimensions:** 48x48 pixels, 4-frame rising animation
**Style:** Pixel-art green cross healing effect. Celeste-style particle burst.
**Palette:** Green (#66bb6a, #4caf50, #81c784) primary. White (#ffffff) centre. Tiny gold sparkles (#ffd54f).
**Key visual elements:**

- Frame 1: Small green cross (+) in centre, white centre pixel
- Frame 2: Cross expands, small floating green + particles rise upward
- Frame 3: Maximum size, green particles swirling clockwise, white sparkles
- Frame 4: Fading -- cross shrinks, particles drift off top edge
- All frames on dark transparent background

**Do NOT include:**

- Red or dark colours
- Text
- Medical cross with human imagery
- More than 4 frames

---

### 4d. Critical Hit Sparks

**File:** `effect-critical.png`
**Dimensions:** 48x48 pixels, 3-frame burst
**Style:** Pixel-art spark/star burst. Celeste crystal break effect.
**Palette:** Gold (#ffd54f, #ffca28, #ffc107) primary. White (#ffffff) core. Tiny red (#ef5350) accent pixels at the tips.
**Key visual elements:**

- Frame 1: Bright white starburst centre, 4 golden diamond-shaped shards flying outward
- Frame 2: Maximum spread, shards fragment into 8 smaller diamonds, trailing single-pixel tails
- Frame 3: Fading, smaller fragments continue outward, 1-2 tiny red sparkles at the tips of the golden
- Frame 4 (optional): One lingering gold sparkle pixel fading out

**Do NOT include:**

- Explosion clouds or smoke
- Dark colours
- Text
- More than 4 frames

---

## 5. Upgrade Icons

**General specifications for all icons:**
- **Dimensions:** 32x32 pixels
- **Style:** Readable pixel icons. Stardew Valley inventory icon quality. Clean silhouettes, 3-4 colours each, transparent background.
- **Palette:** Subject-appropriate (see each), with a consistent 1px white (#ffffff) highlight and 1px dark (#0d1117) shadow.

### 5a. Shield Upgrade

**File:** `upgrade-shield.png`
**Palette:** Cyan (#4fc3f7) primary, dark cyan (#00838f) shadow, white (#ffffff) highlight.
**Elements:** A shield silhouette (rounded top, pointed bottom) with a small upward arrow (+) inside. The shield has a hexagonal surface pattern (3-4 visible hexes). The arrow is gold (#ffd54f).

### 5b. Sword Upgrade

**File:** `upgrade-sword.png`
**Palette:** Silver-grey (#b0bec5) blade, dark grey (#546e7a) edge shadow, cyan (#4fc3f7) energy glow along the blade edge, gold (#ffd54f) hilt wrap.
**Elements:** Vertical sword pointing up. Crossguard is simple horizontal bar. A glowing cyan energy line runs up the centre of the blade. A small gold + or up arrow near the tip.

### 5c. Health Potion

**File:** `upgrade-potion.png`
**Palette:** Green (#66bb6a) liquid, brown (#6d4c41) bottle/cork, white (#ffffff) glass highlight, dark brown (#3e2723) shadow.
**Elements:** A classic pixel potion bottle (round bottom, narrow neck, cork stopper). Liquid level fills about 80% of the bottle. A small glowing plus (+) inside the liquid. Single-pixel glass reflection on the left side.

### 5d. Patch / Wrench

**File:** `upgrade-patch.png`
**Palette:** Grey (#90a4ae) metal, darker grey (#546e7a) shadow, cyan (#4fc3f7) highlight/glow, gold (#ffd54f) gear tooth accents.
**Elements:** A stylised wrench head crossed with a screwdriver (tool cross). The intersection has a small gear/cog with cyan-glowing centre. Two tiny dots above representing "patch notes" or version increment.

---

## 6. Health / Integrity Meter

### 6a. HP Bar Frame

**File:** `health-bar-frame.png`
**Dimensions:** 256x32 pixels (full-width bar)
**Style:** Pixel-art HP bar frame. Classic fighting-game health bar quality (Street Fighter / Dark Souls inspired).
**Palette:** Outer border: dark grey (#1a2332) with cyan accent borders (#4fc3f7). Inner empty region: very dark (#0d1117). Fill gradient: green (#66bb6a) at high, yellow (#ffa726) at mid, red (#ef5350) at low.
**Key visual elements:**

- **Border frame:** 2px pixel border, outer dark grey, inner cyan highlight, with small corner ornaments (tiny squares at each corner like rivets)
- **Background (empty):** Very dark (#0d1117) with subtle horizontal line pattern (every 4px, a 1px slightly lighter line)
- **Tick marks:** Small vertical white tick marks every 20% along the bar (#ffffff, 2px tall, 1px wide)
- **Label area:** Left side has a small 24x24 recessed square for a portrait icon. Right side has a smaller 16x24 region for numbers.
- **Bar segment:** The fill itself (implemented in-engine via CSS `.health-bar` width changes) but the frame should show the outline and expected fill track

**Do NOT include:**

- Animated fill (handled by CSS)
- Text
- Characters

### 6b. Heart Icon

**File:** `icon-heart.png`
**Dimensions:** 16x16 pixels
**Palette:** Red (#ef5350) body, dark red (#c62828) left edge shadow, pink (#ef9a9a) highlight top-left, white (#ffffff) single-pixel shine.
**Elements:** Classic pixel heart shape (two rounded bumps on top, point at bottom). 1px dark shadow on the left side. 1px white highlight top-left corner.

### 6c. Shield Icon (HP variant)

**File:** `icon-shield.png`
**Dimensions:** 16x16 pixels
**Palette:** Cyan (#4fc3f7) body, dark cyan (#00838f) edge shadow, white (#ffffff) highlight.
**Elements:** Miniature shield silhouette. Same shape language as the upgrade icon but simplified for 16x16. Small hex pattern visible (just 3 hexagons).

---

## 7. Victory / Defeat States

### 7a. Victory Trophy

**File:** `state-victory-trophy.png`
**Dimensions:** 64x64 pixels
**Style:** Pixel-art gold trophy cup. Stardew Valley festival reward quality. Celebratory feel.
**Palette:** Gold (#ffd54f, #ffca28, #ffc107) primary, dark gold (#ff8f00) shadow, white (#ffffff) highlight. Red (#ef5350) and cyan (#4fc3f7) ribbon accents.
**Key visual elements:**

- Classic trophy cup shape: wide flared bowl, two ornate handles (loops), a rectangular pedestal base
- Bowl decorated with a small star emblem (cyan) in the centre
- Handles are looped, accented with red ribbon wrapping at the attachment points
- Base has stepped layers, each accented with dark gold shadow
- A small golden glow aura around the trophy (1-2px light gold semi-transparent ring)
- Small sparkle pixels (white) scattered around

**Do NOT include:**

- Characters
- Text
- Dark or depressing elements
- Realistic metallic reflections

### 7b. Defeat Explosion

**File:** `state-defeat.png`
**Dimensions:** 64x64 pixels
**Style:** Pixel-art "wiped out" marker. Game over screen quality. Sad but still cute.
**Palette:** Dark red (#c62828, #b71c1c) primary. Black (#000000) centre. Grey (#4a5568) smoke wisps. White (#ffffff) cross/ X marking.
**Key visual elements:**

- A large, bold X-shaped crack/slash mark (like a "fail" stamp) in the centre
- Red explosion rings radiating outward (2-3 concentric rings, increasing transparency)
- Small dark grey smoke puffs at the edges
- A few scattered small pieces (like broken shield fragments in dark cyan #00838f)
- Optional: A single red pixel "teardrop" shape falling from the top

**Do NOT include:**

- Characters or bodies
- Blood
- Text
- Happy or bright elements
- Realistic destruction

---

## 8. Wave Indicator

**File:** `wave-indicator.png`
**Dimensions:** 128x32 pixels
**Style:** Pixel-art banner/flag for displaying wave numbers. Classic RPG quest banner quality.
**Palette:** Banner fabric: dark cyan (#00838f) with cyan (#4fc3f7) trim. Accents: gold (#ffd54f) end-caps, white (#ffffff) for the numeral area background. Red (#ef5350) optional accent stripe.
**Key visual elements:**

- **Shape:** A horizontal scroll/banner with curled ends. The left end has a gold cylindrical rod (top/bottom small gold rectangles). The scroll curls inward on both sides.
- **Centre panel:** A slightly lighter inset rectangle where the wave number would render (handled by the game engine -- this is the frame). The inset has a subtle pixel gradient.
- **Decorations:** Small cyan diamond shapes (4 total, 2 on each side) flanking the centre panel. A thin gold stripe runs across the top edge of the banner.
- **Side elements:** Small flag pennants (triangular, red #ef5350) hanging from small gold posts at each top corner.
- **Dimensions note:** The centre ~64px is reserved for the numeral text; the decorative ends take ~32px each side.

**Do NOT include:**

- Actual numbers (rendered by the game font system)
- Characters or agents
- Dark or illegible elements

---

## 9. UI Elements

### 9a. Pixel Button (Default)

**File:** `ui-button-default.png`
**Dimensions:** At least 128x40 pixels (stretchable 9-slice, provide a single representative slice)
**Style:** Pixel-art button. Dark arena theme. Press Start 2P font compatible.
**Palette:** Background: dark card (#1a2332) with border (#2a3a4a). Top highlight edge: cyan (#4fc3f7). Bottom shadow edge: darker (#0d1117). Hover glow accent (rendered by CSS `btn-arena:hover`).
**Key visual elements:**

- Rounded rectangle (2-3px corner radius) achieved with pixel stair-steps
- 2px outer border: inner line is lighter (#2a3a4a), outer is darker (#0d1117)
- Top edge: 1px cyan highlight line (#4fc3f7) just below the upper border
- Bottom edge: 1px very dark shadow (#0d1117)
- Subtle horizontal gradient: slightly lighter centre vs edges (card glow style)
- Interior has a faint diagonal line texture (every 3px, descending)

**Do NOT include:**

- Text or icons (these are layered separately)
- Realistic gradients
- Oversized elements

### 9b. Pixel Button (Primary)

**File:** `ui-button-primary.png`
**Palette:** Gradient fill from cyan (#4fc3f7) to dark cyan (#29b6f6). Border: darker cyan (#00838f). Text (rendered separately) on light colour.
**Elements:** Same structural layout as default button, but the interior gradient is cyan-to-dark-cyan, and the top highlight edge is white (#ffffff, semi-transparent). The pixel step corners use the same stair-step approach.

### 9c. Agent Card Frame

**File:** `ui-card-frame.png`
**Dimensions:** At least 200x256 pixels (9-slice stretchable)
**Style:** Pixel-art card frame for agent selection/display.
**Palette:** Card body: (#1a2332). Border: (#2a3a4a). Top accent bar: cyan (#4fc3f7). Corner rivets: dark grey (#3a4a5a) with cyan highlight.
**Key visual elements:**

- Outer border 2px (#2a3a4a) with a 1px inner glow (#4fc3f7 at 30% opacity)
- A thicker accent bar across the top ~8px of the card in cyan (#4fc3f7)
- Four corner rivets: 4x4 pixel squares with a 2x2 dark centre and 1px cyan dot in the middle
- Slightly recessed inner area (1px darker #0f1923 inset border)
- Subtle horizontal scanline texture (every 5px, 1px line at #2a3a4a at 20% opacity)

**Do NOT include:**

- Content inside the card (avatar, name, stats are layered)
- Text

### 9d. Panel Frame (Large)

**File:** `ui-panel-frame.png`
**Dimensions:** At least 400x300 pixels (9-slice stretchable)
**Style:** Larger panel frame for modals, battle log, settings.
**Palette:** Same as card frame plus a thicker outer border with double-line effect.
**Key visual elements:**

- **Outer border:** 3px total. Outer 1px (#0d1117), middle 1px (#2a3a4a), inner 1px (#4fc3f7 at 50% opacity)
- **Corner ornaments:** Slightly larger: 6x6 pixel L-brackets at each corner, cyan (#4fc3f7)
- **Header region:** Top 24px has a slightly darker fill (#0f1923) with a cyan underline (2px) separating it from the body
- **Body:** Standard card fill (#1a2332) with subtle diagonal line texture (descending, every 6px)
- **Close button area:** Top-right corner has a faint 16x16 pixel box outline (in-engine close button positioning guide)

**Do NOT include:**

- Content (handled by engine)
- Text
- Realistic shadows or gradients

---

## Appendix: Colour Reference

All colours referenced in these prompts map to the app's Tailwind / CSS custom properties:

| Token | Hex | Usage |
|-------|-----|-------|
| `arena-bg` | `#0f1923` | Deep background, panel header region |
| `arena-card` | `#1a2332` | Card body, button default fill |
| `arena-border` | `#2a3a4a` | Card/button borders, grid lines |
| `arena-accent` | `#4fc3f7` | Primary cyan accent, shield effects |
| `arena-danger` | `#ef5350` | Health low, enemy indicators, heart |
| `arena-success` | `#66bb6a` | Health high, heal effects |
| `arena-warning` | `#ffa726` | Health mid-range, mimics |
| `arena-pixel` | `#7c4dff` | Purple/magical effects, ghost wisps |
| `arena-gold` | `#ffd54f` | Upgrades, victory, critical hits |
| N/A | `#e0e8f0` | Text primary, light elements |
| N/A | `#8899aa` | Text secondary, muted elements |
| N/A | `#0d1117` | Deep shadows, panel outer borders |

---

## Appendix: Rendering Notes

- **Export format:** PNG with transparency (RGBA), not interlaced.
- **Scale:** Generate at 1x pixel resolution (actual pixel dimensions listed). Do NOT generate at higher resolution and downscale -- true pixel art only.
- **Dithering:** Acceptable for gradients and transparency effects, but keep it minimal (Stardew Valley level, not retro 8-bit extreme).
- **Sprite sheets:** Where noted, arrange frames left-to-right in a single horizontal strip. Each frame must be exactly the same width and height. No gaps between frames.
- **9-slice / stretchable elements:** For UI elements, provide the smallest representative slice that shows all edge treatments, corner ornaments, and fill pattern. Developers will tile the centre area. Document the 9-slice guides (safe zones) in a comment or separate guide image.

---

*Generated for AgentForge -- an AI agent hardening arena. RefundBot-3000 must survive the waves.*
