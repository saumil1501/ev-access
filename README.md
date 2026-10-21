# EV Access — Smart EV Charging Finder

A React + Vite academic prototype for the BCS508 Environmental Studies and E-Waste Management assignment.

## Features
- Responsive dark navy / neon-green interface
- Interactive Leaflet map using OpenStreetMap tiles
- Station search and filters for connector, power and status
- Distance estimates from the map center or the user's location (permission required)
- Demo station dataset with clearly labelled simulated status and pricing
- Optional live station lookup from the public OpenStreetMap Overpass API
- Accessibility insights dashboard with area-wise prototype counts
- Fallback to demo data if the live endpoint is unavailable

## Important data notes
- Demo station coordinates, prices, charging power and availability are illustrative; they are not real-time station information.
- The live lookup uses OpenStreetMap community data through Overpass. Coverage may be incomplete and the endpoint may rate-limit or be unavailable.
- OpenStreetMap data generally does not provide reliable real-time port availability or tariffs. The UI displays these as unknown/unavailable rather than inventing live values.
- The coverage indicator and area groupings are educational heuristics, not official accessibility or infrastructure-planning scores.
- For a production deployment, use a reliable station API, review its terms and rate limits, add error handling/caching, and obtain live status/pricing from charging-network operators.

## Run locally
Install Node.js (LTS), then in this project folder run:

```bash
npm install
npm run dev
```

Open the local URL Vite prints (typically `http://localhost:5173`).

Build and test the production bundle:

```bash
npm run build
npm run preview
```

## Publish using GitHub Pages
1. Create a GitHub repository and upload the contents of this folder.
2. In `package.json`, add a `homepage` only if you plan to use a custom deployment setup; for the simplest Vite workflow, configure the repository base path first.
3. If the repository name is `ev-access`, add `base: '/ev-access/'` to `vite.config.js` (create it with the Vite config below), then commit and push.
4. In GitHub, open **Settings → Pages** and select **GitHub Actions** as the build source.
5. Use a Vite GitHub Pages workflow, or deploy the generated `dist` directory with an action such as `peaceiris/actions-gh-pages`.
6. Test the public link on both desktop and mobile before submitting the assignment.

Example `vite.config.js` for a repository named `ev-access`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/ev-access/',
})
```

For a simpler no-build hosting option, use Netlify or Vercel and connect the GitHub repository; their default Vite detection generally configures the build command as `npm run build` and output directory as `dist`.

## Assignment mapping
- **Problem:** EV charging accessibility and discoverability
- **Solution:** A searchable station finder and infrastructure coverage insights
- **Technology:** React, JavaScript, Leaflet, OpenStreetMap, Overpass API, browser geolocation
- **Input:** Station coordinates, connector and power metadata, search filters, optional device location
- **Processing:** Distance calculation, filter matching, sorting, geographic grouping
- **Output:** Interactive map, station cards, estimated distance, connector/power details and area counts
- **Environmental benefits:** Supports EV adoption, reduces unnecessary searching, helps identify underserved areas and improves visibility of existing infrastructure.
