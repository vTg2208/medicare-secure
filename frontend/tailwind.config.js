/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Shared Medicare identity. Legacy hue names intentionally resolve to this ramp.
        ...Object.fromEntries(['primary', 'secondary', 'indigo', 'violet', 'purple', 'blue', 'sky', 'cyan', 'teal'].map(name => [name, {
          50: '#edf5f2', 100: '#e5f3ef', 200: '#c4e5d9', 300: '#a8e5cc',
          400: '#4dc4b5', 500: '#087f78', 600: '#087f78', 700: '#066b65',
          800: '#23574e', 900: '#193a33', 950: '#102b27',
        }])),
        ...Object.fromEntries(['slate', 'gray', 'zinc', 'neutral'].map(name => [name, {
          50: '#f5f8f7', 100: '#edf5f2', 200: '#d9e3e3', 300: '#b6cbc7',
          400: '#a0b4b1', 500: '#5e7275', 600: '#4a6261', 700: '#2d4843',
          800: '#1c3837', 900: '#142b2b', 950: '#102322',
        }])),
        ...Object.fromEntries(['green', 'emerald'].map(name => [name, {
          50: '#edf8f1', 100: '#e2f2e8', 200: '#c8e7d3', 300: '#a8dbc1', 400: '#5fa883',
          500: '#28734f', 600: '#28734f', 700: '#216245', 800: '#214b35', 900: '#213f33', 950: '#132c23',
        }])),
        ...Object.fromEntries(['red', 'rose'].map(name => [name, {
          50: '#fff2f2', 100: '#fbe4e6', 200: '#f2ccd0', 300: '#ffc7cc', 400: '#d8737e',
          500: '#b23843', 600: '#b23843', 700: '#a12e36', 800: '#74343c', 900: '#482d33', 950: '#321f24',
        }])),
        ...Object.fromEntries(['amber', 'orange', 'yellow'].map(name => [name, {
          50: '#fff7e8', 100: '#f9ecd6', 200: '#e9d5ae', 300: '#f5ce8c', 400: '#ce9838',
          500: '#86530a', 600: '#86530a', 700: '#74480b', 800: '#594424', 900: '#40351f', 950: '#2d2519',
        }])),
        canvas: 'var(--mc-canvas)', surface: 'var(--mc-surface)',
        ink: 'var(--mc-text)', muted: 'var(--mc-text-muted)',
        line: 'var(--mc-border)', accent: 'var(--mc-accent)',
        dark: { bg: '#102322', card: '#142b2b', text: '#e1eeeb', muted: '#a0b4b1', border: '#34504d' },
        success: '#28734f', danger: '#b23843', warning: '#86530a', info: '#256374',
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'sans-serif'] },
      // Text aliases resolve semantically so muted/accent text stays readable in both themes.
      textColor: {
        ...Object.fromEntries([['green','success'],['emerald','success'],['red','danger'],['rose','danger'],['amber','warning'],['orange','warning'],['yellow','warning']].map(([name,kind]) => [name, Object.fromEntries([300,400,500,600,700,800,900,950].map(tone => [tone, `var(--mc-${kind})`]))])),
        ...Object.fromEntries(['primary', 'secondary', 'indigo', 'violet', 'purple', 'blue', 'sky', 'cyan', 'teal'].map(name => [name, Object.fromEntries([300, 400, 500, 600, 700, 800, 900, 950].map(tone => [tone, 'var(--mc-accent)']))])),
        ...Object.fromEntries(['slate', 'gray', 'zinc', 'neutral'].map(name => [name, {
          400: 'var(--mc-text-subtle)', 500: 'var(--mc-text-muted)', 600: 'var(--mc-text-muted)',
          700: 'var(--mc-text)', 800: 'var(--mc-text)', 900: 'var(--mc-text)', 950: 'var(--mc-text)',
        }])),
      },
      borderRadius: { lg: '9px', xl: '9px', '2xl': '16px', '3xl': '16px' },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'slide-down': 'slideDown 0.3s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
      boxShadow: {
        'soft': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'card': '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)',
        'glow': '0 4px 18px rgb(23 59 59 / 5%)',
      },
    },
  },
  plugins: [],
}

