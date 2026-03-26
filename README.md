<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/f5a11595-7575-42f3-8c21-db1357e04e2f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## GitHub Pages

This repo is configured to deploy to GitHub Pages from the `main` branch using GitHub Actions.

1. In GitHub repository settings, open `Settings -> Pages`.
2. Set `Source` to `GitHub Actions`.
3. Push to `main` or run the `Deploy to GitHub Pages` workflow manually.

The site will be published under `https://llayon.github.io/gGolems/`.
