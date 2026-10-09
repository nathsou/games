// Card themes change only the artwork. Every card shows its number, which is
// what the rules use. Each theme has twelve original illustrated atlas cells.
export const THEMES = {
  classic: {name: 'Classic', accent: '#f2b84b', back: '#2d3a6b'},
  bakery: {name: 'Bakery', accent: '#f0a868', back: '#7a3e2b'},
  sea: {name: 'Deep Sea', accent: '#5cc8d8', back: '#123f63'},
  sky: {name: 'Night Sky', accent: '#b9a2ff', back: '#231d4f'},
  garden: {name: 'Garden Bugs', accent: '#9fd36b', back: '#2f5a2b'},
  robots: {name: 'Robots', accent: '#ff7aa8', back: '#3a2547'},
};
export const artwork = (theme, value) => {
  const index = value - 1;
  return `background-image:url(assets/${theme}.webp);background-position:${index % 4 * 100 / 3}% ${Math.floor(index / 4) * 50}%`;
};
