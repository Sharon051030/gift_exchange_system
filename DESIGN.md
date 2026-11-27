---
version: alpha
colors:
  paper: "#F4EEDB"
  paperRaised: "#FFF9E9"
  loadingPine: "#103C29"
  homepageEgg: "#FFDFA0"
  primary: "#B63439"
  olive: "#69724D"
  pine: "#344E37"
  antiqueGold: "#CFA05B"
  dustyPink: "#E6B4AD"
  ink: "#302D24"
  mutedInk: "#6C675A"
  danger: "#9F282E"
typography:
  display:
    fontFamily: "Georgia, Times New Roman, serif"
    lineHeight: "0.96"
  body:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, system-ui, sans-serif"
    lineHeight: "1.65"
  utility:
    fontFamily: "Arial, Noto Sans TC, PingFang TC, sans-serif"
    lineHeight: "1.3"
rounded:
  control: "6px"
  paper: "12px"
  portrait: "18px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "28px"
  xl: "48px"
components:
  openingLoading:
    backgroundColor: "{colors.loadingPine}"
    textColor: "{colors.paperRaised}"
  openingHomepage:
    backgroundColor: "{colors.homepageEgg}"
    textColor: "{colors.ink}"
  page:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
  statusRail:
    backgroundColor: "{colors.paperRaised}"
    textColor: "{colors.pine}"
  primaryButton:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.paperRaised}"
    rounded: "{rounded.control}"
    padding: "16px"
  giftSlot:
    backgroundColor: "{colors.olive}"
    textColor: "{colors.paperRaised}"
    rounded: "{rounded.paper}"
  printAccent:
    backgroundColor: "{colors.antiqueGold}"
    textColor: "{colors.ink}"
  revealCard:
    backgroundColor: "{colors.paperRaised}"
    textColor: "{colors.mutedInk}"
    rounded: "{rounded.portrait}"
  revealCardAccent:
    backgroundColor: "{colors.dustyPink}"
    textColor: "{colors.ink}"
  dangerBanner:
    backgroundColor: "{colors.dustyPink}"
    textColor: "{colors.ink}"
  dangerAction:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.paperRaised}"
---

# Christmas Mystery Gift Design System

## Overview

The product should feel like a host opening a well loved 1950s Christmas storybook on a projector. The public cover may be theatrical, while the live stage stays legible and calm enough for fifty people to follow. A faceted candy cane waits on pine-green paper, arcs through a warm yellow wash, and dissolves into the gold light that winds around a fixed paper-sculpture tree and gifts. The interactive signature that follows remains the tactile paper wall: each selected wrapping surface dents, cracks, and finally opens into a portrait frame. Avoid neon, glass effects, glossy photorealistic 3D, generic SaaS cards, and decorations that compete with slot numbers.

## Colors

Cream paper owns most product surfaces. The opening begins on `loadingPine` and finishes on `homepageEgg`; these two fields are narrative states, not interchangeable page backgrounds. Pine and ink carry readable information; berry red is reserved for the primary action and active state. Antique gold is a thin printed accent and particle color, never a low contrast text color. Dusty pink belongs to reveal portraits and small paper scraps.

The runtime source of truth is `app/globals.css`. DOM components consume its variables directly and the opening scene reads its computed theme colours at runtime. The sculpted objects use warmer local tints for candy, gilding, ivory paper and wood, while lights and paper grain supply variation across faces.

## Typography

The English cover title uses the locally served Bodoni Moda Italic variable face under the SIL Open Font License, with dark bronze satin highlights. Traditional Chinese controls, names, status, errors, and blessings use the CJK body stack. Slot numbers use the system display serif at projector scale.

## Layout

The finished cover is an open editorial two-column storybook spread without a framed theater: title and action on the left, the generated 3D tree and gifts on the right. During loading, the candy cane owns the exact center of the viewport. Narrow screens place the tree above the copy so the signature remains in the first viewport. The stage uses one status rail and an open gift wall, not nested cards. Desktop targets ten columns; tablets and phones collapse naturally to five and three or four columns. The wall owns its scroll only when the surrounding product shell requires it; this implementation keeps document scrolling.

The admin route uses a quieter operations-ledger register: one dark pine navigation rail, one cream working surface, semantic tables, and horizontal health strips. It keeps natural document scrolling; table overflow belongs to each table wrapper rather than the page shell.

## Elevation & Depth

Depth comes from offset ink shadows, torn-paper overlaps, and one restrained reveal-card shadow. Static controls remain mostly flat. No blur or translucent glass surfaces.

## Shapes

Edges are slightly irregular and mostly square. Primary buttons use clipped ticket corners instead of pill shapes. Portraits may be softly rounded because they represent old photo frames.

## Components

Gift slots share six wrapping patterns and a single semantic state model: ready, first hit, second hit, draw pending, breaking, reveal, closing, and opened. The WebGL shader visualizes pressure and tearing but never advances the draw; the reducer and server response own phase changes. Reveal dialogs use the same close behavior, inert background, focus treatment, and postcard anatomy whether opened from a new draw or replayed from the wall.

Three.js is reserved for four high-value layers: the continuous candy-cane opening scene, ambient stage particles, the one active punch surface, and the reveal atmosphere. The 50 gift controls remain semantic DOM buttons. High, standard, and low effect levels adjust DPR and particle/fragment counts; reduced-motion and WebGL fallback paths keep every operation available without spatial animation.

The cover layer owns one sequence: the loading candy and motes keep their launch positions, then draw together around a widening vortex during the feathered top-to-bottom colour wash. The tree unfolds from the star down to its trunk, then the presents spring from the root and settle. The fixed camera and upper-left warm key light keep the composition grounded. Timing lives in `lib/opening-experience.ts`. Reduced motion and unavailable WebGL resolve directly to the completed homepage composition.

The gold orbit is an invisible route. A diffuse halo follows it while motes of different sizes twinkle and emit their own soft halos. When reduced motion is enabled, the motes and their glow stay still.

Admin status tags use text plus tone, never color alone. The participant and gift datasets are bounded to 50 rows per pool and remain semantic tables. The dashboard search is local and intentionally transient so participant names do not enter shareable URLs.

## Do's and Don'ts

- Do keep numbers, names, counts, and actions readable from a projector.
- Do keep all interactive controls code native and keyboard reachable.
- Do let pattern and paper texture express the theme.
- Do lazy-load WebGL and GSAP code and dispose generated textures when a scene unmounts.
- Do keep the candy flight, colour wash, gold spiral and opacity reveals on one shared timeline with a fixed camera.
- Do wait for a successful server response before the breaking and reveal phases.
- Do not place decorative imagery over controls or status text.
- Do not use color as the only state cue.
- Do not imply that animation decides a draw result.
- Do not create one canvas per unopened gift or make the canvas the interactive control.
- Do not reintroduce the framed gift-box theater on the public cover or make the loading scene compete with visible marketing copy.
