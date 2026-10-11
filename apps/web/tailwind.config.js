const baseConfig = require("@downtown/config/tailwind.config.js");

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...baseConfig,
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
};
