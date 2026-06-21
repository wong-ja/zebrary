module.exports = {
  content: ["./views/**/*.{html,ejs}", "./public/js/**/*.js"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        zeb: {
          dark: '#1e1e1e',
          light: '#ebebeb',
          navy: '#1d2f6f',
          blue: '#8390fa',
          gold: '#fac748',
          soft: '#f9e9ec',
          pink: '#f88dad',
        }
      }
    }
  },
  plugins: [],
}
