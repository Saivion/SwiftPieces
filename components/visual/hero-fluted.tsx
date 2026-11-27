"use client";
import { useEffect, useRef } from "react";

/**
 * The hero's fluted glass (Saivion, 2026-11-26): the pricing card's ember (wine core, red, orange, pink
 * edge) rising from behind the phones, seen through tall glass ribs that bend in a slow wave. One
 * fragment shader on a transparent canvas over the plain page, so the screens stand in front of it.
 * The copy keeps a clear oval. It drifts slowly, pauses off screen, and Reduce Motion gets a still.
 *
 * `centre` and `radius` place the glow as shares of the canvas (radius x and y both in widths);
 * `veil` is the clear oval round the copy, as a share of the canvas: centre x/y and radii.
 */
export type FlutedVeil = { x: number; y: number; rx: number; ry: number };

const VS = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;
const FS = `precision highp float;
uniform vec2 res,C,R;uniform vec4 VEIL;uniform vec3 FADE;uniform float AMP;uniform float t,dark;
vec3 ember(float x){x=clamp(x,0.,1.);
  vec3 w=vec3(.29,.039,.031),r=vec3(.949,.212,.110),o=vec3(1.,.541,.361),p=vec3(1.,.757,.839),b=vec3(1.,.93,.92);
  if(x<.22)return mix(w,r,x/.22);if(x<.48)return mix(r,o,(x-.22)/.26);if(x<.74)return mix(o,p,(x-.48)/.26);return mix(p,b,(x-.74)/.26);}
float glow(vec2 px){
  // the glow drifts and breathes a little as the ribs sway
  vec2 c=C+vec2(sin(t*.09),cos(t*.07))*.02*step(.01,AMP);
  vec2 q=(px-c*res)/(R*res.x*(1.+.04*sin(t*.11)*step(.01,AMP)));return clamp(1.-length(q),0.,1.);}
void main(){
  vec2 px=vec2(gl_FragCoord.x,res.y-gl_FragCoord.y);
  float s=res.x/1440.;
  // tall ribs, bent by a slow wave
  float w=34.*s;
  float bx=px.x+sin(px.y/(150.*s)+px.x/(520.*s)+t*.22)*AMP*s;
  float x=fract(bx/w)*2.-1.;
  // each rib is a lens: it shifts the glow it shows sideways
  float I=glow(px+vec2(-x*w*1.6,0.));
  float I2=glow(px);
  vec3 col=ember(1.-I);
  col=mix(col,vec3(1.),(1.-abs(x))*.18*I2);
  vec4 o=vec4(col,1.)*smoothstep(0.,.5,I)*.95;
  o+=vec4(1.)*pow(abs(x),12.)*.25*smoothstep(0.,.3,I2)*(dark>.5?.6:1.);
  vec2 e=(px-VEIL.xy*res)/(VEIL.zw*res);
  o*=smoothstep(.75,1.25,length(e));
  // fade out before the canvas ends, so the glass never stops at a hard edge over the next section
  // (narrower windows fade over a shorter run, so phones keep their glow)
  float dpr=res.x/max(FADE.x,1.);
  float from=FADE.z+(FADE.y-FADE.z)*clamp(FADE.x/1000.,.4,1.);
  o*=1.-smoothstep(res.y-from*dpr,res.y-FADE.z*dpr,px.y);
  // and in from the top edge, so a glow that reaches it never shows a hard line
  o*=smoothstep(0.,90.*dpr,px.y);
  gl_FragColor=clamp(o,0.,1.);
}`;

export function HeroFluted({
  centre = [0.5, 0.9],
  radius = [0.66, 0.5],
  veil = { x: 0.5, y: 0.3, rx: 0.34, ry: 0.15 },
  fade = [320, 160],
  wave = 26,
  className,
}: {
  centre?: [number, number];
  radius?: [number, number];
  veil?: FlutedVeil;
  /** Fade out from this many css px above the canvas's bottom edge to this many. */
  fade?: [number, number];
  /** How far the ribs bend, in css px at 1440 wide; 0 keeps them straight. */
  wave?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [cx, cy] = centre;
  const [rx, ry] = radius;
  const { x: vx, y: vy, rx: vrx, ry: vry } = veil;
  const [fadeFrom, fadeTo] = fade;

  useEffect(() => {
    const cv = ref.current;
    const gl = cv?.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!cv || !gl) return;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const pr = gl.createProgram()!;
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const al = gl.getAttribLocation(pr, "a");
    gl.enableVertexAttribArray(al);
    gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(pr, n);
    gl.uniform2f(U("C"), cx, cy);
    gl.uniform2f(U("R"), rx, ry);
    gl.uniform4f(U("VEIL"), vx, vy, vrx, vry);
    const uT = U("t");
    const uRes = U("res");
    const uDark = U("dark");
    const uFade = U("FADE");
    gl.uniform1f(U("AMP"), wave);

    // The theme lives on <html> (theme-script.tsx); the rib highlight is softer on dark.
    const root = document.documentElement;
    const readTheme = () => gl.uniform1f(uDark, root.classList.contains("dark") ? 1 : 0);
    readTheme();

    // straight ribs have nothing to animate, so they draw once like Reduce Motion
    const reduced = wave === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let visible = true;
    const t0 = performance.now();
    const draw = (now: number) => {
      gl.uniform1f(uT, reduced ? 0 : (now - t0) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const tick = (now: number) => {
      raf = 0;
      draw(now);
      if (!reduced && visible) raf = requestAnimationFrame(tick);
    };
    const mo = new MutationObserver(() => {
      readTheme();
      draw(performance.now());
    });
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    const ro = new ResizeObserver(([e]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(1, Math.round(e.contentRect.width * dpr));
      cv.height = Math.max(1, Math.round(e.contentRect.height * dpr));
      gl.viewport(0, 0, cv.width, cv.height);
      gl.uniform2f(uRes, cv.width, cv.height);
      // css width, then where the fade starts and ends, in css px above the bottom edge
      gl.uniform3f(uFade, e.contentRect.width, fadeFrom, fadeTo);
      draw(performance.now());
    });
    ro.observe(cv);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf && !reduced) raf = requestAnimationFrame(tick);
    });
    io.observe(cv);
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      ro.disconnect();
      io.disconnect();
    };
  }, [cx, cy, rx, ry, vx, vy, vrx, vry, fadeFrom, fadeTo, wave]);

  return <canvas ref={ref} aria-hidden className={className ?? "pointer-events-none absolute inset-x-0 -top-[var(--nav-h)] z-0 block h-[calc(100%+var(--nav-h)+160px)] w-full"} />;
}
