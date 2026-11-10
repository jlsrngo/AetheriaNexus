import fs from 'fs';
import path from 'path';

const PROMPTS_DIR = 'temp_mg_styles/prompts';
const TARGET_SKILLS_DIR = '.aetheria/skills';

const STYLE_NAMES = {
  '01-flat-vector.md': { id: 'mg-flat-vector', title: 'Flat Vector Clean Tech' },
  '02-line-art.md': { id: 'mg-line-art', title: 'Minimalist Line Art' },
  '03-isometric.md': { id: 'mg-isometric', title: 'Isometric 3D Architecture' },
  '04-3d-render.md': { id: 'mg-3d-spatial', title: '3D Spatial Lighting' },
  '05-cel-boil.md': { id: 'mg-cel-boil', title: 'Hand-Drawn Cel Animation Boil' },
  '06-collage.md': { id: 'mg-cutout-collage', title: 'Dada Cutout Paper Collage' },
  '07-liquid.md': { id: 'mg-liquid-fluid', title: 'Liquid Blob Fluid Morph' },
  '08-morph.md': { id: 'mg-shape-morph', title: 'Seamless Shape Morph' },
  '09-bauhaus.md': { id: 'mg-bauhaus-swiss', title: 'Bauhaus Swiss Constructivist' },
  '10-synthwave.md': { id: 'mg-synthwave-retro', title: 'Retro 80s Synthwave Grid' },
  '12-aurora-glass.md': { id: 'mg-aurora-glass', title: 'Aurora Glassmorphism Glow' },
  '18-hanazi.md': { id: 'mg-kinetic-calligraphy', title: 'Kinetic Calligraphy Typography' },
  '19-paperclip.md': { id: 'mg-paperclip-sticker', title: 'PaperClip Bold Sticker Explainer' },
  '20-pixel.md': { id: 'mg-pixel-arcade', title: 'Retro 8-Bit Pixel Arcade' },
  '22-hud.md': { id: 'mg-sci-fi-hud', title: 'Sci-Fi Cyberpunk HUD Interface' },
};

function main() {
  if (!fs.existsSync(PROMPTS_DIR)) {
    console.error('Prompts directory not found:', PROMPTS_DIR);
    return;
  }

  const files = fs.readdirSync(PROMPTS_DIR).filter(f => f.endsWith('.md'));
  console.log(`Found ${files.length} style prompts to convert into skills.`);

  for (const file of files) {
    const meta = STYLE_NAMES[file] || {
      id: 'mg-' + file.replace('.md', '').toLowerCase(),
      title: file.replace('.md', '')
    };

    const rawContent = fs.readFileSync(path.join(PROMPTS_DIR, file), 'utf8');
    const skillDir = path.join(TARGET_SKILLS_DIR, meta.id);
    fs.mkdirSync(skillDir, { recursive: true });

    const frontmatter = `---
name: ${meta.id}
description: "${meta.title} motion design archetype from mg-styles-15. Award-shortlist commercial motion graphics standard for Remotion."
tags:
  - motion-graphics
  - mg-styles-15
  - remotion
  - visual-archetype
command: /${meta.id}
---

# ${meta.title} (Motion Graphics Standard)
*Ported from award-winning mg-styles-15 motion system.*

`;

    const fullSkill = frontmatter + rawContent;
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), fullSkill);
    console.log(`Created skill: ${meta.id} -> ${skillDir}/SKILL.md`);
  }
}

main();

