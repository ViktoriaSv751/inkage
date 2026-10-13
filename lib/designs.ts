// A small library of original line-art designs (drawn for InkAge), so people can try the app
// without hunting for an image first. Each is black ink on a transparent background.

const svg = (body: string, sw = 7) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 200 200" fill="none" stroke="#111" stroke-width="${sw / 3}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
  )}`;

export type LibDesign = { id: string; en: string; hu: string; style: 'fine-line' | 'blackwork' | 'traditional'; src: string; thumb?: string };

export const DESIGNS: LibDesign[] = [
  {
    id: 'moon',
    en: 'Crescent moon',
    hu: 'Holdsarló',
    style: 'fine-line',
    src: svg(
      `<path d="M120 30a72 72 0 1 0 50 120A60 60 0 0 1 120 30z"/><path d="M150 52l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/><path d="M168 96l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><circle cx="140" cy="128" r="1.5" fill="#111"/>`,
      5
    ),
  },
  {
    id: 'wave',
    en: 'Wave',
    hu: 'Hullám',
    style: 'blackwork',
    src: svg(
      `<path d="M20 140c20-6 30-30 52-52 26-26 70-24 78 6 6 22-14 36-30 26-12-8-6-26 8-24"/><path d="M20 160c30 0 40-14 60-14s30 14 60 14 30-14 40-14"/><path d="M30 120c14-10 18-28 34-40"/><path d="M60 140c6-16 20-34 40-40"/>`,
      8
    ),
  },
  {
    id: 'flower',
    en: 'Wildflower',
    hu: 'Vadvirág',
    style: 'fine-line',
    src: svg(
      `<path d="M100 185V92"/><path d="M100 150c-18-4-30-16-32-32 16 2 28 14 32 32z"/><path d="M100 128c16-4 26-16 28-30-14 2-24 12-28 30z"/><circle cx="100" cy="68" r="10"/><path d="M100 58c-8-20 8-34 0-44-8 10 8 24 0 44M110 68c20-8 34 8 44 0-10-8-24 8-44 0M100 78c8 20-8 34 0 44M90 68c-20 8-34-8-44 0 10 8 24-8 44 0"/><path d="M108 60c14-14 32-8 36-18-12-2-24 4-36 18M92 76c-14 14-32 8-36 18 12 2 24-4 36-18M108 76c14 14 8 32 18 36 2-12-4-24-18-36M92 60c-14-14-8-32-18-36-2 12 4 24 18 36"/>`,
      4
    ),
  },
  {
    id: 'mountains',
    en: 'Mountains',
    hu: 'Hegyek',
    style: 'fine-line',
    src: svg(`<circle cx="100" cy="100" r="80"/><path d="M28 136l44-56 22 28 24-40 54 68"/><path d="M60 95l12-15 10 12M110 80l8-12 12 18"/><circle cx="142" cy="62" r="9"/><path d="M40 152h120M56 166h88"/>`, 5),
  },
  {
    id: 'swallow',
    en: 'Swallow',
    hu: 'Fecske',
    style: 'blackwork',
    src: svg(
      `<path d="M30 70c30 6 50 20 64 40 10-30 36-50 78-54-20 14-34 30-42 52 20-4 34 0 44 8-22 4-40 12-56 28l-6 30-12-26c-18 8-36 4-52-8 18 0 30-6 38-16-22-6-42-24-56-54z" fill="#111"/>`,
      4
    ),
  },
  {
    id: 'sun',
    en: 'Sun',
    hu: 'Nap',
    style: 'blackwork',
    src: svg(`<circle cx="100" cy="100" r="34" fill="#111"/>${Array.from({ length: 12 }, (_, i) => {
      const a = (i * Math.PI) / 6;
      const r1 = 46, r2 = i % 2 ? 70 : 84;
      return `<path d="M${(100 + r1 * Math.cos(a)).toFixed(1)} ${(100 + r1 * Math.sin(a)).toFixed(1)}L${(100 + r2 * Math.cos(a)).toFixed(1)} ${(100 + r2 * Math.sin(a)).toFixed(1)}"/>`;
    }).join('')}`, 9),
  },
  {
    id: 'butterfly',
    en: 'Butterfly',
    hu: 'Pillangó',
    style: 'fine-line',
    src: svg(
      `<path d="M100 60v90"/><path d="M100 64c-6-14-12-20-20-24M100 64c6-14 12-20 20-24"/><path d="M100 90c-20-40-60-50-74-36-12 14 6 46 40 50-26 6-34 30-20 42 16 12 44-6 54-36"/><path d="M100 90c20-40 60-50 74-36 12 14-6 46-40 50 26 6 34 30 20 42-16 12-44-6-54-36"/><circle cx="56" cy="74" r="6"/><circle cx="144" cy="74" r="6"/>`,
      4
    ),
  },
  {
    id: 'heart',
    en: 'Heart line',
    hu: 'Szív vonal',
    style: 'fine-line',
    src: svg(`<path d="M10 110h50l10-24 14 52 14-70 12 52 8-10h20"/><path d="M128 110c0 0 14-30 34-24 18 6 14 30-4 46l-30 26-30-26"/>`, 4),
  },
  {
    id: 'anchor',
    en: 'Anchor',
    hu: 'Horgony',
    style: 'blackwork',
    src: svg(`<circle cx="100" cy="38" r="12"/><path d="M100 50v120M72 76h56"/><path d="M40 120c4 30 30 50 60 50s56-20 60-50"/><path d="M30 130l10-14 14 10M170 130l-10-14-14 10"/>`, 9),
  },
];

/** Original flash designs (AI-drawn for InkAge, black ink on white). */
// served through our own /api/lib-img (edge-cached copies of the original files)
const CDN = '/api/lib-img?f=';
export const FLASH: LibDesign[] = [
  { id: 'rose', en: 'Rose', hu: 'Rózsa', style: 'fine-line', src: CDN + 'hf_20261012_155954_fd830d0f-7102-4ef8-94d3-6f8b588ae649.png', thumb: CDN + 'hf_20261012_155954_fd830d0f-7102-4ef8-94d3-6f8b588ae649.png&w=240' },
  { id: 'peony', en: 'Peony', hu: 'Bazsarózsa', style: 'traditional', src: CDN + 'hf_20261012_155956_d83e6d90-66cb-436c-b967-28a5369f392e.png', thumb: CDN + 'hf_20261012_155956_d83e6d90-66cb-436c-b967-28a5369f392e.png&w=240' },
  { id: 'lotus', en: 'Lotus', hu: 'Lótusz', style: 'fine-line', src: CDN + 'hf_20261012_160152_9db5fdde-624b-4de8-a6b7-57e314491d0a.png', thumb: CDN + 'hf_20261012_160152_9db5fdde-624b-4de8-a6b7-57e314491d0a.png&w=240' },
  { id: 'sunflower', en: 'Sunflower', hu: 'Napraforgó', style: 'blackwork', src: CDN + 'hf_20261012_155953_f335869b-9c9d-46f4-99e3-4f83fc01aef4.png', thumb: CDN + 'hf_20261012_155953_f335869b-9c9d-46f4-99e3-4f83fc01aef4.png&w=240' },
  { id: 'olive', en: 'Olive branch', hu: 'Olajág', style: 'fine-line', src: CDN + 'hf_20261012_155954_5f316dfe-3c06-41c9-b70d-4884782f810b.png', thumb: CDN + 'hf_20261012_155954_5f316dfe-3c06-41c9-b70d-4884782f810b.png&w=240' },
  { id: 'sakura', en: 'Cherry blossom', hu: 'Cseresznyevirág', style: 'fine-line', src: CDN + 'hf_20261012_155954_24fefc55-f996-4860-ada2-678584116ebe.png', thumb: CDN + 'hf_20261012_155954_24fefc55-f996-4860-ada2-678584116ebe.png&w=240' },
  { id: 'fern', en: 'Fern', hu: 'Páfrány', style: 'fine-line', src: CDN + 'hf_20261012_160152_868aea8e-611f-42c1-8f39-f50f45f941f2.png', thumb: CDN + 'hf_20261012_160152_868aea8e-611f-42c1-8f39-f50f45f941f2.png&w=240' },
  { id: 'hummingbird', en: 'Hummingbird', hu: 'Kolibri', style: 'fine-line', src: CDN + 'hf_20261012_160151_675b340e-434f-4654-bb3f-7ed1808542a5.png', thumb: CDN + 'hf_20261012_160151_675b340e-434f-4654-bb3f-7ed1808542a5.png&w=240' },
  { id: 'koi', en: 'Koi', hu: 'Koi ponty', style: 'traditional', src: CDN + 'hf_20261012_155953_5df63f18-0d86-47ec-8ca3-628756e58560.png', thumb: CDN + 'hf_20261012_155953_5df63f18-0d86-47ec-8ca3-628756e58560.png&w=240' },
  { id: 'snake-rose', en: 'Snake & rose', hu: 'Kígyó és rózsa', style: 'traditional', src: CDN + 'hf_20261012_155955_3b3fb696-b00d-426e-a105-d9b672a2cc0f.png', thumb: CDN + 'hf_20261012_155955_3b3fb696-b00d-426e-a105-d9b672a2cc0f.png&w=240' },
  { id: 'dragon', en: 'Dragon', hu: 'Sárkány', style: 'fine-line', src: CDN + 'hf_20261012_160153_bed55035-592d-42ba-99af-4cc599f7bc13.png', thumb: CDN + 'hf_20261012_160153_bed55035-592d-42ba-99af-4cc599f7bc13.png&w=240' },
  { id: 'tiger', en: 'Tiger', hu: 'Tigris', style: 'traditional', src: CDN + 'hf_20261012_155955_e4238215-ade5-4d01-ba52-b4232cd97c5e.png', thumb: CDN + 'hf_20261012_155955_e4238215-ade5-4d01-ba52-b4232cd97c5e.png&w=240' },
  { id: 'wolf', en: 'Geometric wolf', hu: 'Geometrikus farkas', style: 'blackwork', src: CDN + 'hf_20261012_160203_66778a69-2c2c-4918-8276-a6d307e08e3c.png', thumb: CDN + 'hf_20261012_160203_66778a69-2c2c-4918-8276-a6d307e08e3c.png&w=240' },
  { id: 'cat', en: 'One-line cat', hu: 'Egyvonalas macska', style: 'fine-line', src: CDN + 'hf_20261012_160203_b4ec5e17-5cbf-4e99-bd2c-aed918cbef11.png', thumb: CDN + 'hf_20261012_160203_b4ec5e17-5cbf-4e99-bd2c-aed918cbef11.png&w=240' },
  { id: 'phoenix', en: 'Phoenix', hu: 'Főnix', style: 'blackwork', src: CDN + 'hf_20261012_160202_c91bb1df-0285-4516-b2fe-68da21125ccb.png', thumb: CDN + 'hf_20261012_160202_c91bb1df-0285-4516-b2fe-68da21125ccb.png&w=240' },
  { id: 'dagger', en: 'Dagger & rose', hu: 'Tőr és rózsa', style: 'traditional', src: CDN + 'hf_20261012_160203_741c8459-dc7d-4eb0-b996-cb6c229543d0.png', thumb: CDN + 'hf_20261012_160203_741c8459-dc7d-4eb0-b996-cb6c229543d0.png&w=240' },
  { id: 'compass', en: 'Compass', hu: 'Iránytű', style: 'fine-line', src: CDN + 'hf_20261012_160011_071ebf09-abfb-4c1a-ac18-71390946e494.png', thumb: CDN + 'hf_20261012_160011_071ebf09-abfb-4c1a-ac18-71390946e494.png&w=240' },
  { id: 'lighthouse', en: 'Lighthouse', hu: 'Világítótorony', style: 'fine-line', src: CDN + 'hf_20261012_160012_371e0d7b-7de6-43d6-b945-19e34a67858a.png', thumb: CDN + 'hf_20261012_160012_371e0d7b-7de6-43d6-b945-19e34a67858a.png&w=240' },
  { id: 'skull', en: 'Skull & flowers', hu: 'Koponya virágokkal', style: 'traditional', src: CDN + 'hf_20261012_160009_4ac24a28-1f15-4c9c-9b57-7be42abb7661.png', thumb: CDN + 'hf_20261012_160009_4ac24a28-1f15-4c9c-9b57-7be42abb7661.png&w=240' },
  { id: 'eye', en: 'Eye', hu: 'Szem', style: 'fine-line', src: CDN + 'hf_20261012_160010_5f8d8f57-f532-4aa3-9ea2-45d1d0c92649.png', thumb: CDN + 'hf_20261012_160010_5f8d8f57-f532-4aa3-9ea2-45d1d0c92649.png&w=240' },
  { id: 'sun-moon', en: 'Sun & moon', hu: 'Nap és hold', style: 'fine-line', src: CDN + 'hf_20261012_160011_b8e8d615-11f7-405c-820b-b1f0e45496c8.png', thumb: CDN + 'hf_20261012_160011_b8e8d615-11f7-405c-820b-b1f0e45496c8.png&w=240' },
  { id: 'scorpion', en: 'Scorpion', hu: 'Skorpió', style: 'blackwork', src: CDN + 'hf_20261012_160012_354b55ff-b58e-4537-9199-0f337d9dc720.png', thumb: CDN + 'hf_20261012_160012_354b55ff-b58e-4537-9199-0f337d9dc720.png&w=240' },
  { id: 'lavender', en: 'Lavender', hu: 'Levendula', style: 'fine-line', src: CDN + 'hf_20261012_160012_443b1cdb-ffd7-411d-9386-832be4741b00.png', thumb: CDN + 'hf_20261012_160012_443b1cdb-ffd7-411d-9386-832be4741b00.png&w=240' },
];
export const ALL_DESIGNS: LibDesign[] = [...FLASH, ...DESIGNS];
