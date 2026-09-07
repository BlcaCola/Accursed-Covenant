import Phaser from 'phaser';

/** Explicit trimmed frame coordinates: image generation does not guarantee atlas grid alignment. */
export const FRAMES = [
  [43, 43, 232, 277], [389, 43, 200, 277], [640, 44, 216, 276], [979, 42, 204, 277],
  [51, 337, 240, 310], [305, 337, 287, 317], [641, 338, 238, 303], [896, 320, 324, 328],
  [48, 687, 239, 211], [407, 657, 111, 258], [658, 710, 199, 176], [988, 675, 175, 237],
  [52, 914, 194, 278], [381, 924, 170, 270], [619, 942, 261, 249], [963, 966, 203, 225],
];

/**
 * The demo atlas has a pale matte rather than alpha. Chroma-key ONLY neutral pale
 * pixels in the rendering pipeline; the original PNG remains unmodified.
 * Production sprites should have authored alpha and use Phaser's standard pipeline.
 */
export class SpriteKeyPipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
  constructor(game: Phaser.Game, magenta = false) {
    super({ game, fragShader: `
      precision mediump float;
      uniform sampler2D uMainSampler;
      varying vec2 outTexCoord;
      varying float outTintEffect;
      varying vec4 outTint;
      void main() {
        vec4 tex = texture2D(uMainSampler, outTexCoord);
        float hi = max(tex.r, max(tex.g, tex.b));
        float lo = min(tex.r, min(tex.g, tex.b));
        ${magenta ? 'if (tex.r > 0.55 && tex.b > 0.60 && tex.g < 0.40) discard;' : 'if (lo > 0.88 && hi - lo < 0.045) discard;'}
        vec4 tint = vec4(outTint.bgr * outTint.a, outTint.a);
        vec4 color = tex * tint;
        if (outTintEffect == 1.0) color.rgb = mix(tex.rgb, outTint.bgr * outTint.a, tex.a);
        else if (outTintEffect == 2.0) color = tint;
        gl_FragColor = color;
      }
    ` });
  }
}

export function registerArt(scene: Phaser.Scene): void {
  const texture = scene.textures.get('atlas');
  FRAMES.forEach(([x, y, w, h], i) => texture.add(String(i), 0, x, y, w, h));
  const renderer = scene.game.renderer;
  if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer && !renderer.pipelines.has('SpriteKey')) renderer.pipelines.add('SpriteKey', new SpriteKeyPipeline(scene.game));
  if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer && !renderer.pipelines.has('HeroKey')) renderer.pipelines.add('HeroKey', new SpriteKeyPipeline(scene.game, true));
  const equipment=scene.textures.get('equipment-atlas'),equipmentSource=equipment.getSourceImage();
  for(let row=0;row<4;row++)for(let col=0;col<4;col++)equipment.add(String(row*4+col),0,col*equipmentSource.width/4,row*equipmentSource.height/4,equipmentSource.width/4,equipmentSource.height/4);
}

export { directionFrame } from './directions';

export function sprite(scene: Phaser.Scene, frame: number, x: number, y: number, height: number): Phaser.GameObjects.Image {
  const image = scene.add.image(x, y, 'atlas', String(frame)).setOrigin(.5, .96);
  image.setScale(height / FRAMES[frame][3]);
  image.setPipeline('SpriteKey');
  return image;
}

/** Use clean runtime-atlas silhouettes while the old prop concept sheet is retained only as source reference. */
export function propSprite(scene:Phaser.Scene,frame:number,x:number,y:number,height:number):Phaser.GameObjects.Image {
  return sprite(scene,[12,13,15,15,14,8,13,15][frame]??12,x,y,height);
}
