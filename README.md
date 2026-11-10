# I Want to Be My Own Mechanic!

A browser game for learning car mechanics, in English and Romanian. Drive, notice the symptoms, take the car into the garage, read fault codes with an OBD scanner, test with real tools, find the faulty part, then strip and rebuild it in the order a real mechanic would.

## ▶ How to play
- **Online:** open **https://alii981.github.io/my-own-mechanic/** in Chrome, Edge or Firefox. Nothing to install.
- **Offline file:** download [`play-offline.html`](play-offline.html) (click it, then the download button) and double-click it. It still needs an internet connection the first time, to load the 3D library.

## Features
- **4 cars:** Renault Koleos 2.0 dCi (M9R, 4x4), VW Golf 4 1.9 TDI (ALH), Škoda Octavia II 1.6 MPI (BSE), Daewoo Matiz 0.8 (F8CV)
- **100 scenarios** (25 per car), based on common real-world faults, with indirect hints and sources
- **Realistic disassembly:** parts come off in the right order, and you can remove any part freely (right-click or long-press)
- **Lessons:** how a diesel engine and a petrol engine work, step by step, with highlighted parts
- **3D** with Three.js and **synthesized sounds** with the Web Audio API

## Run it locally
JS modules don't load when you open the file directly, so start a local server in the project folder:

```
python -m http.server 8000
```

Then open http://localhost:8000. You need an internet connection, because Three.js loads from cdn.jsdelivr.net.

## Play online (GitHub Pages)
Settings → Pages → Source: "Deploy from a branch", branch `main`, folder `/ (root)`. The game will be live at `https://<user>.github.io/my-own-mechanic/`.

## Project structure
| File | What it does |
|---|---|
| `index.html`, `style.css` | Page layout and styles |
| `js/main.js` | Game logic: road, garage, tools, repairs, lessons |
| `js/scene3d.js` | 3D scene and car models |
| `js/parts.js`, `js/cars.js` | Part catalogue and per-car configuration |
| `js/scen_*.js` | Scenarios for each car |
| `js/lesson.js` | Engine lessons |
| `js/audio.js` | Synthesized sounds |
| `js/i18n.js` | English and Romanian text |

## Disclaimer
This is a learning game, not a service manual. Before working on a real car, check the manufacturer's procedures and torque specs, and work safely.
