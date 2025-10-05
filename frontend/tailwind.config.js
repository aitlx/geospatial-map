/** @type {import('tailwindcss').Config} */
import daisyui from "daisyui";

const config = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [daisyui],
};

export default config;