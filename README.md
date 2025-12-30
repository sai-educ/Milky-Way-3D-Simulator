# Milky Way 3D Simulator

An interactive, scientifically-grounded 3D simulation of the Milky Way Galaxy using Three.js. This project visualizes the galaxy's structure, including spiral arms, the central bar, and dust lanes, with a focus on visual fidelity and performance.

## Features

*   **Scientifically Accurate Structure:**
    *   **Barred Spiral (SBc):** accurately depicts the Milky Way's central bar and two major stellar arms (Perseus and Scutum-Centaurus).
    *   **Stellar Distribution:** Uses Gaussian distribution for a natural, non-uniform star field.
    *   **Dust Lanes:** Procedurally generated dark dust lanes that follow the spiral structure.
*   **High-Quality Rendering:**
    *   **Dual-Scene Pipeline:** Uses a bloom effect for the galaxy stars while keeping text labels crisp and readable.
    *   **FXAA:** Fast Approximate Anti-Aliasing for smooth edges.
    *   **Performance Optimized:** Efficient particle systems for stars and dust.
*   **Interactive Controls:**
    *   **Orbit Controls:** Zoom, rotate, and pan around the galaxy.
    *   **Guided Tour:** A step-by-step tour highlighting key features like the Sun's position and the Galactic Center.
    *   **View Modes:** Quickly switch between Top-Down, Edge-On, and Sun perspectives.

## Scientific Data

The simulation is based on current astronomical data:
*   **Galaxy Diameter:** ~100,000 light-years (visualized scale).
*   **Sun Position:** ~26,000 light-years from the center, in the Orion Spur.
*   **Colors:** Based on stellar population data (warm core, blueish/white spiral arms).

## Usage

1.  Clone the repository.
2.  Serve the directory using a local web server (e.g., `python3 -m http.server`, `live-server`, or VS Code Live Server).
3.  Open `index.html` in your browser.

## Technologies

*   [Three.js](https://threejs.org/) - 3D Rendering Engine
*   [GSAP](https://greensock.com/gsap/) - Animation Library (for camera transitions)

## Credits

Based on scientific data from NASA/ESA and Wikipedia reference material.