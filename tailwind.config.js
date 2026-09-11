/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        vipred: "#D90000",
        darkred: "#8B0000",
        charcoal: "#151515"
      },
      boxShadow: {
        red: "0 0 40px rgba(217,0,0,.25)"
      }
    }
  },
  plugins: []
};