// Card themes change only the artwork. Every card shows its number, which is
// what the rules use. Icons are system emoji, so no image files are needed.
export const THEMES = {
  classic: {name: 'Classic', icons: [], accent: '#f2b84b', back: '#2d3a6b'},
  bakery: {name: 'Bakery', icons: ['🥐', '🥖', '🍩', '🧁', '🍪', '🥧', '🎂', '🍰', '🥞', '🧇', '🍮', '🍫'], accent: '#f0a868', back: '#7a3e2b'},
  sea: {name: 'Deep Sea', icons: ['🐚', '🦀', '🦐', '🐠', '🐡', '🦑', '🐙', '🐢', '🪼', '🐬', '🦈', '🐳'], accent: '#5cc8d8', back: '#123f63'},
  sky: {name: 'Night Sky', icons: ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌟', '🌗', '🌘', '☄️', '🪐', '🚀'], accent: '#b9a2ff', back: '#231d4f'},
  garden: {name: 'Garden Bugs', icons: ['🐌', '🐛', '🐜', '🐝', '🐞', '🦋', '🌻', '🦗', '🪲', '🪱', '🕷️', '🐸'], accent: '#9fd36b', back: '#2f5a2b'},
  robots: {name: 'Robots', icons: ['🔩', '🔋', '🧲', '💾', '📡', '🕹️', '🤖', '👾', '🛸', '⚙️', '🔧', '🎮'], accent: '#ff7aa8', back: '#3a2547'},
};
export const icon = (theme, value) => THEMES[theme]?.icons[value - 1] || '';
