NEXT ORIGIN — WEBSITE, JS ENTRY ANIMATION ENGINE & STRICT NXO SYSTEM
===================================================================

1. FOLDER STRUCTURE
-------------------
  next-origin-v6/
  ├── index.html                        Clean entry HTML (no inline animation markup)
  ├── 404.html                          Custom liquid glass 404 error page
  ├── vercel.json                       Vercel routing & direct-access 404 protection
  ├── router.txt                        Runtime bundle pointer
  ├── logo.png                          Official Next Origin brand logo
  ├── app_list.nxo                      Strict application catalog
  ├── README.txt                        Setup & NXO documentation
  └── _core/
      └── v9x/
          ├── nxo_8f4c2a91e7b3.dat      Encoded Liquid Glass stylesheet payload
          └── nxo_3d9e7b10c5f4.dat      Encoded JS logic + Entry Animation Engine


2. ENTRY ANIMATION & CONSOLE COMMAND (`load.animation.nxo`)
-----------------------------------------------------------
- Purely JavaScript-Driven:
  All entry animation DOM creation, timing, and state management live inside the
  separated JS bundle (`NXOEntryController`) rather than `index.html`.
- First-Visit Playback:
  On a visitor's first visit, a 1-second Liquid Glass emblem + progress animation
  plays while assets and `app_list.nxo` load. Once completed, `localStorage` caches
  the state so reopening or refreshing loads immediately without repeating.
- Developer Console Replay Command:
  Open the browser Developer Console and type:
    load.animation.nxo
  (or `load.animation.nxo()`) to replay the 1-second entry animation on demand.


3. CUSTOM 404 & DIRECT-ACCESS PROTECTION (`vercel.json`)
--------------------------------------------------------
- Opening `/_core`, `/Core`, `/_core/...`, `/router.txt`, or any missing file such as
  `/wiwi.html` directly in the browser serves `/404.html` with an HTTP `404` status.


4. STRICT NXO FORMATTING RULES (`app_list.nxo`)
-----------------------------------------------
App name :- Lion Pay
App logo :- 1.png
App describe :- A modern payment application.
Apk file :- demo.apk
Display picture :- home.png, dashboard.png
---------------------------------------------
