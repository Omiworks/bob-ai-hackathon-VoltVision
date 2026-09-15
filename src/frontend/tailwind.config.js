/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Restrained industrial palette — deep charcoal/slate surfaces,
        // subtle blue-gray accents. No neon. No gradients.
        app: {
          // body background
          bg: "#0B1117",
          // sidebar — dark, slightly deeper than the body
          sidebar: "#0A1016",
          // sticky top bar
          header: "#0D141B",
          // main content surface
          main: "#101820",
          // cards / panels
          panel: "#151E26",
          // raised stripes / chips / table header
          raised: "#18232C",
          // table body / rows
          table: "#111920",
          // hover surfaces
          hover: "#19242D",
          // subtle gray-blue borders
          border: "#27333D",
          borderDim: "#1D2833",
          // primary text: soft white
          text: "#E6EDF3",
          // secondary text
          muted: "#8B98A5",
          // labels / tertiary text
          label: "#657482",
          // restrained industrial blue accent
          accent: "#4D8CCB",
          accentDim: "#3C71A8",
        },
        // Muted status colors (not neon).
        critical: "#c8574f",
        high: "#cf8f3f",
        medium: "#c0a33d",
        low: "#4f9e6b",
      },
    },
  },
  plugins: [],
};