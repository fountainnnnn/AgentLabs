# GPT Image 2 Asset Prompts for AgentForge

Generate these assets using GPT Image 2 (DALL-E 4). All sprites should be 32-bit pixel art style with transparent backgrounds. Use image-rendering: pixelated in CSS.

---

## 1. Target Agent: RefundBot

```
cute 32-bit pixel art ninja raccoon agent, small heroic stance, blue scarf around neck,
grey-blue fur, dark eye mask, standing on two legs facing right at three-quarter angle,
transparent background, no text, game character sprite, front-facing ready pose,
clean readable silhouette, pixel art style similar to Celeste or Stardew Valley
```
Size: 96x96px or 128x128px

---

## 2. Prompt Injection Enemy

```
cute 32-bit pixel art glitch fox enemy, orange-red corrupted aura, fragmented edges,
glitchy eye effect, small sharp pose, transparent background, no text, game enemy sprite,
digital corruption theme, pixel art style
```
Size: 58x58px

---

## 3. Role Impersonation Enemy

```
cute 32-bit pixel art masked cat enemy, purple disguise mask covering eyes, sneaky crouched pose,
mysterious shadow beneath, purple-grey fur, deceptive expression, transparent background,
no text, game enemy sprite, pixel art style
```
Size: 58x58px

---

## 4. Emotional Manipulation Enemy

```
cute 32-bit pixel art teary rabbit enemy, pink-red emotional aura, dramatic pleading pose,
single tear pixel, heart-shaped shadow, soft pink tones, transparent background,
no text, game enemy sprite, pixel art style
```
Size: 58x58px

---

## 5. Tool Abuse Enemy

```
cute 32-bit pixel art mechanical badger enemy, holding tiny wrench in paw, yellow sparks
around wrench, gear details on body, industrial brown-grey fur, determined stance,
transparent background, no text, game enemy sprite, pixel art style
```
Size: 58x58px

---

## 6. Policy Extraction Enemy

```
cute 32-bit pixel art spy owl enemy, cyan cloak draped over body, magnifying glass held
in wing, large knowing eyes, stealthy perched pose, teal-cyan color scheme,
transparent background, no text, game enemy sprite, pixel art style
```
Size: 58x58px

---

## 7. Multi-turn Escalation Boss Enemy

```
cute 32-bit pixel art boss wolf enemy, red spiked armor vest, multiple abstract speech
bubble shapes floating beside head, larger than standard enemies, commanding stance,
dark red-grey fur, glowing red eyes, transparent background, no text, game boss sprite,
pixel art style
```
Size: 72x72px

---

## 8. Arena Background

```
wide 32-bit pixel art dark training arena, stone floor tiles with grid pattern,
glowing blue runes carved into floor, dark metallic lab wall in background,
blue ambient lighting from ceiling, sci-fi dojo atmosphere, 16:9 aspect ratio,
no characters, no text, game background art, deep navy and charcoal color palette,
pixel art style
```
Size: 1920x1080px

---

## 9. Shield Effect

```
32-bit pixel art blue transparent shield burst effect, circular hexagonal energy barrier,
bright cyan-blue rings expanding outward, glowing impact point at center,
transparent background, no text, game VFX sprite, pixel art style
```
Size: 128x128px (centered)

---

## 10. Level Up Effect

```
32-bit pixel art purple-blue level up burst, vertical energy beam rising from bottom,
sparkle particles rising upward, purple to gold color transition at edges,
transparent background, no text, game VFX sprite, pixel art style
```
Size: 96x128px (tall vertical)

---

## 11. Broken / Defeated State

```
cute 32-bit pixel art defeated ninja raccoon agent, sitting tired on ground,
cracked hexagonal shield lying beside it, head drooped down, small bandage on arm,
blue scarf still visible but dusty, transparent background, no text, game sprite,
pixel art style
```
Size: 96x96px

---

## 12. Victory Pose

```
cute 32-bit pixel art heroic ninja raccoon agent victory pose, both arms raised,
blue scarf flowing upward, small gold sparkles around body, confident wide stance,
bright eyes, transparent background, no text, game sprite, pixel art style
```
Size: 96x96px

---

## Color Palette Reference

| Element | Hex | Usage |
|---------|-----|-------|
| Cyan/Shield | #63D4FF | Shield effects, info, blocked status |
| Blue/Info | #75A7FF | Primary buttons, active generation |
| Green/Success | #52E0A3 | Pass status, high integrity |
| Red/Danger | #FF5C7A | Fail status, low integrity, prompt injection |
| Purple/Upgrade | #A78BFA | Patches, upgrades, role impersonation |
| Orange/Attack | #FF9F43 | Attack events, emotional manipulation |
| Yellow/Warning | #F7C948 | Warnings, tool abuse |
| Dark BG | #070A0F | App background |
| Panel BG | #0B0F17 | Left panel |
| Surface | #101622 | Cards and elevated surfaces |

---

## Usage Notes

1. All sprites should render cleanly at multiples of their native resolution (2x, 4x)
2. Use `image-rendering: pixelated` in CSS for sharp scaling
3. Save as PNG with transparency
4. Place generated files in `assets/placeholders/` and reference from components
5. Sprite sheets for animations should be horizontal strips with equal frame widths
