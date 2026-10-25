# Kitchen Crisp design direction

## Brief

Kitchen Crisp is a small Indian food and premix shop. Customers need to understand the product, compare pack prices, add items, and place a COD order. The design should feel like a printed pantry catalogue: specific, practical and recognisable. The supplied red wordmark is the brand cue. Photography and sample product content remain placeholders until the real catalogue is supplied.

## Structure and journeys

The home page introduces both premixes and ready-to-eat food with an immediate shop link. A numbered index highlights breakfast, premixes, food platters and cookies. Catalogue filters distinguish preparation type from food category; product labels and detail instructions make clear whether cooking is required. Product details, bag and delivery forms use dialogs. The kitchen note, ordering instructions and FAQs answer questions after the products. Admin work lives at `/admin`.

Key flows: category/search → product → bag → verified account → address → COD confirmation; email/password → emailed OTP → account/orders; verified admin → products → add/edit/visibility → storefront.

## Visual system

- Chilli red `#b3341d`: brand, primary actions and focus.
- Soft mint green `#f2f8f5`: background. Forest charcoal `#1c2b22`: text and rules.
- Mint accent `#e3f1e9`: photo caption and ordering strip.
- Secondary text `#4f6458`; separator `#cbe0d3`.
- Bricolage Grotesque for headings and product names; DM Sans for information and controls; Georgia only for the logo.
- Rectangular photography, square controls, thin rules, no decorative floating stamps, stars or unsupported reviews.
- Space separates sections; imagery and type provide hierarchy. Body copy is readable and concise. Tiny labels are supplemental, never the sole source of product or order information.

## Components and states

| Component | Behaviour |
|---|---|
| Category index | Jumps to catalogue and selects the category |
| Catalogue controls | Selected filter is dark; search is available at every size; sorting uses native select |
| Product card | Photo/name opens details; price and pack size stay visible; add button reports quantity |
| Bag | Quantity controls, delivery threshold, totals and sign-in/checkout action |
| Account | Labelled forms, OTP input, clear errors and disabled controls while submitting |
| Admin | Product rows, order status controls, image preview, save feedback |

Empty states say what is missing and how to proceed. Product badges display only supplied badge data. Hiding a product does not prevent its removal from an existing bag. Checkout reports price changes before accepting an order.

## Responsive and accessibility checks

Desktop uses a split hero and three product columns. Tablet keeps a compact split hero; mobile uses a left-aligned headline, rectangular photo and two product columns. Numbered category links become rows. Ordering steps and FAQs stack. Dialogs fit the available viewport; keyboard focus, native dialog focus containment, labelled fields and reduced-motion support remain in place. Controls use explicit accessible names.

Verify the catalogue, mobile header, product details and bag after styling changes. Keep sample product labels visible. Replace stock photographs with true product/prepared-food photography before launch.
