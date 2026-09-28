// Converts the design-bundle images in project/uploads into web-sized WebP files
// under public/img. Re-run after replacing any source image: `npm run images`.
import sharp from 'sharp';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'project/uploads';
const OUT = 'public/img';

// [source file, output name, max width, max height]
// Posters display at up to 560px wide, so 1120px covers 2x screens.
// Logos display at up to 84px tall, so 240px covers 2x+ screens.
const IMAGES = [
  ['MT Center copy.png', 'logo-mt-center-header', 600, 240],
  ['MT Center.png', 'logo-mt-center', 600, 240],
  ['MT Logo.png', 'logo-mt-company', 600, 240],
  ['PRL Logo.png', 'logo-prl', 600, 240],
  ['PRL Logo-a9809fea.png', 'logo-prl-group', 600, 240],
  ['iBliss Logo.png', 'logo-ibliss', 600, 240],
  ['MTH Logo.png', 'logo-mth', 600, 240],
  ['MTH Logo-5cfd98d1.png', 'logo-mth-group', 600, 240],
  ['P1 Starter_0.png', 'poster-p1-starter', 1120],
  ['P2 Standard_0.png', 'poster-p2-standard', 1120],
  ['P3 Extra.png', 'poster-p3-extra', 1120],
  ['P4 Supreme_0.png', 'poster-p4-supreme', 1120],
  ['P5 Beyond M_0.png', 'poster-p5-beyond-m', 1120],
  ['P6 Beyond F_0.png', 'poster-p6-beyond-f', 1120],
  ['P7 Signature M_0.png', 'poster-p7-signature-m', 1120],
  ['P8 Signature F_0.png', 'poster-p8-signature-f', 1120],
  ['P9 Ultimate M_0.png', 'poster-p9-ultimate-m', 1120],
  ['P10 Ultimate F_0.png', 'poster-p10-ultimate-f', 1120],
  ['Allergy.jpg', 'poster-allergy', 1120],
  ['HPV15.jpg', 'poster-hpv15', 1120],
  ['STD14.jpg', 'poster-std14', 1120],
  ['STD 880 square.png', 'poster-std5', 1120],
  ['Tumor Screen Male.png', 'poster-tumor-screen-m', 1120],
  ['Tumor Screen Female.png', 'poster-tumor-screen-f', 1120],
  ['Tumor Plus Male.png', 'poster-tumor-plus-m', 1120],
  ['Tumor Plus Female.png', 'poster-tumor-plus-f', 1120],
  ['Marriage for Male.png', 'poster-marriage-m', 1120],
  ['Marriage for Female.png', 'poster-marriage-f', 1120],
  ['Advance Heart Vascular.jpg', 'poster-heart-vascular', 1120],
  ['Thyroid Basic.png', 'poster-thyroid-basic', 1120],
  ['Thyroid Full.png', 'poster-thyroid-full', 1120],
];

await mkdir(OUT, { recursive: true });
let before = 0, after = 0;
for (const [src, name, w, h] of IMAGES) {
  const from = path.join(SRC, src);
  const to = path.join(OUT, name + '.webp');
  await sharp(from)
    .resize({ width: w, height: h, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(to);
  before += (await stat(from)).size;
  after += (await stat(to)).size;
}
console.log(`${IMAGES.length} images: ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB`);
