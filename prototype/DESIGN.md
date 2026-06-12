---
name: AeroBeat
colors:
  surface: '#f9f9ff'
  surface-dim: '#c8dbff'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d5e3ff'
  on-surface: '#001b3c'
  on-surface-variant: '#3e4850'
  inverse-surface: '#003061'
  inverse-on-surface: '#ecf1ff'
  outline: '#6e7881'
  outline-variant: '#bdc8d1'
  surface-tint: '#00658d'
  primary: '#00658d'
  on-primary: '#ffffff'
  primary-container: '#00aeef'
  on-primary-container: '#003e58'
  inverse-primary: '#82cfff'
  secondary: '#426900'
  on-secondary: '#ffffff'
  secondary-container: '#b8f568'
  on-secondary-container: '#467000'
  tertiary: '#5d5f5f'
  on-tertiary: '#ffffff'
  tertiary-container: '#a2a3a3'
  on-tertiary-container: '#37393a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c6e7ff'
  primary-fixed-dim: '#82cfff'
  on-primary-fixed: '#001e2d'
  on-primary-fixed-variant: '#004c6b'
  secondary-fixed: '#b8f568'
  secondary-fixed-dim: '#9dd84f'
  on-secondary-fixed: '#112000'
  on-secondary-fixed-variant: '#304f00'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#f9f9ff'
  on-background: '#001b3c'
  surface-variant: '#d5e3ff'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Work Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-sm:
    fontFamily: Work Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-padding: 24px
  gutter: 16px
  glass-margin: 12px
---

## Brand & Style
The design system captures the optimistic, "humanist-tech" aesthetic of the mid-2000s. It evokes a sense of freshness, cleanliness, and technological wonder through the use of organic motifs (water, air, light) paired with high-gloss digital surfaces. 

The visual language is rooted in **Frutiger Aero**—specifically characterized by skeuomorphic depth, specular highlights, and "Aero Glass" transparency. The UI should feel like a physical object made of polished polycarbonate and liquid crystals. Animation should be fluid and elastic, mimicking the physics of water or glass.

## Colors
The palette is designed to look "vibrant and ventilated," relying on high-saturation blues and greens balanced by airy whites.

- **Sky Blue (Primary):** Used for interactive elements and highlights. Should often be applied as a linear gradient from top-to-bottom.
- **Lime Green (Secondary):** Used for "Success" states and rhythm-hit indicators (Perfect/Great). It represents energy and growth.
- **Crystal White (Tertiary):** The base for glass panels and highlights. Always used with varying levels of opacity.
- **Deep Ocean Blue (Neutral):** Reserved for high-contrast text and deep shadows to provide grounding and legibility against bright backgrounds.

## Typography
The typography uses clean, humanist sans-serifs to emulate the "Segoe UI" and "Frutiger" typefaces of the era. 

To maintain the skeuomorphic feel, all display and headline text should utilize a subtle `0px 1px 2px rgba(0,0,0,0.2)` drop shadow or a white "glow" outer shadow when placed over dark backgrounds. Avoid extreme weights; "Bold" and "Regular" are sufficient to maintain the airy, professional feel.

## Layout & Spacing
This design system utilizes a **fluid grid** with generous safe areas to ensure the "airy" composition isn't compromised. 

Layouts should be centered and symmetrical where possible. Use "Floating Glass" containers rather than edge-to-edge blocks. Spacing should feel intentional and spacious, with large internal padding inside glass panels (minimum 24px) to allow the background textures (or "auroras") to be visible through the UI.

## Elevation & Depth
Depth is achieved through **Glassmorphism** and **Specular Highlights**. 

1.  **Backgrounds:** Use high-definition imagery featuring water droplets, blue skies, or soft green fields with "aurora" light streaks.
2.  **Panels (Aero Glass):** Surfaces use a semi-transparent white fill (opacity 40-70%) with a `backdrop-filter: blur(20px)`.
3.  **Borders:** Every panel must have a 1.5pt solid white border at 50% opacity to simulate the edge of a glass pane.
4.  **Shadows:** Use large, soft ambient shadows with a slight blue tint (`rgba(0, 51, 102, 0.1)`) rather than pure grey/black.

## Shapes
Organic, soft shapes are mandatory. Sharp corners should be strictly avoided. Containers use a default radius of `16px` (rounded-lg) to evoke a friendly, tactile feel. Circular elements are used for avatars, progress indicators, and "Hit" zones in the rhythm gameplay.

## Components
- **Buttons:** 3D-extruded appearance. Use a linear gradient (light to dark) with a "gloss" overlay—a semi-transparent white ellipse covering the top half of the button. On hover, the inner glow should intensify.
- **Progress Bars:** High-volume "Capsule" style. The filled portion should look like a liquid-filled tube with a bright specular highlight running horizontally through the center.
- **Cards:** Use the "Aero Glass" style. Apply a subtle inner shadow to create a "beveled" look at the edges of the glass.
- **Input Fields:** Recessed/Inscribed look. Use an inner shadow to make the field appear as if it is carved into the glass surface.
- **Chips/Badges:** Pill-shaped with a high-gloss finish, using the Secondary (Green) color for positive status and Primary (Blue) for neutral categories.
- **Rhythm Notes:** Spherical, "water-drop" style assets with a concentrated white highlight at the top-left to signify 3D depth.