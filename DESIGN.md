---
version: alpha
colors:
  paper: "#F4EEDB"
  paperRaised: "#FFF9E9"
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

The product should feel like a host opening a well loved 1950s Christmas storybook on a projector. The public cover may be theatrical, while the live stage stays legible and calm enough for fifty people to follow. Its memorable signature is a paper theater: a tactile 3D parcel becomes a torn-paper portal, then each selected wrapping surface dents, cracks, and finally opens into a portrait frame. Avoid neon, glass effects, glossy photorealistic 3D, generic SaaS cards, and decorations that compete with slot numbers.

## Colors

Cream paper owns most of the canvas. Pine and ink carry readable information; berry red is reserved for the primary action and active state. Antique gold is a thin printed accent, never a low contrast text color. Dusty pink belongs to reveal portraits and small paper scraps.

The runtime source of truth is `app/globals.css`. Variables there map one to one to the values above; DOM components consume variables directly and the Three.js scene reads those same computed CSS variables at runtime. Scene materials must not introduce an independent palette.

## Typography

English display copy uses the system serif stack with restrained letterpress texture. Traditional Chinese controls, names, status, errors, and blessings always use the complete CJK body stack. Slot numbers use the display stack at projector scale. No web font is loaded until licensing and Traditional Chinese coverage are approved.

## Layout

The cover is an editorial two-column storybook spread: title and action on the left, the interactive paper theater on the right. Narrow screens place the theater first so the signature remains in the first viewport. The stage uses one status rail and an open gift wall, not nested cards. Desktop targets ten columns; tablets and phones collapse naturally to five and three or four columns. The wall owns its scroll only when the surrounding product shell requires it; this implementation keeps document scrolling.

The admin route uses a quieter operations-ledger register: one dark pine navigation rail, one cream working surface, semantic tables, and horizontal health strips. It keeps natural document scrolling; table overflow belongs to each table wrapper rather than the page shell.

## Elevation & Depth

Depth comes from offset ink shadows, torn-paper overlaps, and one restrained reveal-card shadow. Static controls remain mostly flat. No blur or translucent glass surfaces.

## Shapes

Edges are slightly irregular and mostly square. Primary buttons use clipped ticket corners instead of pill shapes. Portraits may be softly rounded because they represent old photo frames.

## Components

Gift slots share six wrapping patterns and a single semantic state model: ready, first hit, second hit, draw pending, breaking, reveal, closing, and opened. The WebGL shader visualizes pressure and tearing but never advances the draw; the reducer and server response own phase changes. Reveal dialogs use the same close behavior, inert background, focus treatment, and postcard anatomy whether opened from a new draw or replayed from the wall.

Three.js is reserved for four high-value layers: the cover parcel, ambient stage particles, the one active punch surface, and the reveal atmosphere. The 50 gift controls remain semantic DOM buttons. High, standard, and low effect levels adjust DPR and particle/fragment counts; reduced-motion and WebGL fallback paths keep every operation available without spatial animation.

Admin status tags use text plus tone, never color alone. The participant and gift datasets are bounded to 50 rows per pool and remain semantic tables. The dashboard search is local and intentionally transient so participant names do not enter shareable URLs.

## Do's and Don'ts

- Do keep numbers, names, counts, and actions readable from a projector.
- Do keep all interactive controls code native and keyboard reachable.
- Do let pattern and paper texture express the theme.
- Do lazy-load WebGL and GSAP code and dispose generated textures when a scene unmounts.
- Do wait for a successful server response before the breaking and reveal phases.
- Do not place decorative imagery over controls or status text.
- Do not use color as the only state cue.
- Do not imply that animation decides a draw result.
- Do not create one canvas per unopened gift or make the canvas the interactive control.
