"use client";
import { useEffect, useRef, useState } from "react";

/**
 * The hero's satin stage (Saivion, 2026-11-26): pleated satin lit from above, in the Sunset palette,
 * glowing up from behind the phones so the copy sits on the quiet top. One fragment shader: a field of
 * folded sine pleats whose slope shades it (shadows walk down the palette, never to grey), a soft sheen
 * on the lit folds and fine seeded grain. Dark mode sits on plum, light mode on light grey.
 * It drifts slowly, draws only on screen, and Reduce Motion gets one still frame.
 */
const PALETTES = {
  // Core of the glow first, out to the ground.
  dark: { cols: ["#fff1e0", "#ffc9a3", "#ff8a5c", "#e8456b", "#3d0f2e", "#120612"], sheen: "#fff6ec" },
  light: { cols: ["#fff1e0", "#ffc9a3", "#ff8a5c", "#ec5a72", "#f5c3b6", "#e9e8e5"], sheen: "#ffffff" },
};

const VS = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;
const FS = `precision highp float;
uniform vec2 res;uniform float t,seed;uniform vec3 PC[6];uniform vec3 PS;
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
vec3 ramp(float x){x=clamp(x,0.,1.)*5.;
  if(x<1.)return mix(PC[0],PC[1],x);if(x<2.)return mix(PC[1],PC[2],x-1.);if(x<3.)return mix(PC[2],PC[3],x-2.);if(x<4.)return mix(PC[3],PC[4],x-3.);return mix(PC[4],PC[5],x-4.);}
// the pleats: tight vertical folds, bent by two slow waves
float pleat(vec2 p){return sin(p.x*30.+sin(p.y*6.+p.x*2.2+t*.25)*2.6+sin(p.y*15.+p.x*5.-t*.18)*.45+t*.15);}
void main(){
  vec2 uv=gl_FragCoord.xy/res; uv.y=1.-uv.y;
  float a=res.x/res.y;
  vec2 p=vec2(uv.x*a,uv.y);
  // the glow rises from below the bottom edge, wide for a landscape stage
  vec2 q=vec2((p.x-.5*a)/max(a*.62,1.),(1.32-p.y)*1.05);
  float d=length(q);
  float x=smoothstep(.3,1.12,d);
  float m=1.-smoothstep(.82,1.12,d);
  float e=2./res.y; float h=pleat(p), hx=pleat(p+vec2(e,0.)), hy=pleat(p+vec2(0.,e));
  vec3 n=normalize(vec3(-vec2(hx-h,hy-h)/e*.055*m,1.));
  vec3 L=normalize(vec3(-.25,-.65,.72));
  float dif=clamp(dot(n,L),0.,1.);
  float spec=pow(clamp(dot(reflect(-L,n),vec3(0,0,1)),0.,1.),9.);
  vec3 col=ramp(x+h*.07*m+(1.-dif)*m*.34);
  col=mix(col,PS,spec*.45*m);
  col+=.06*(1.-smoothstep(0.,.6,d))*PS;
  col+=(hash(gl_FragCoord.xy+seed)-.5)*.045;
  gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

export function HeroSatin({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [light, setLight] = useState(false);

  // The theme lives on <html> (theme-script.tsx); follow it live so the toggle repaints.
  useEffect(() => {
    const d = document.documentElement;
    const read = () => setLight(d.classList.contains("light"));
    read();
    const mo = new MutationObserver(read);
    mo.observe(d, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    const cv = ref.current;
    const gl = cv?.getContext("webgl", { alpha: false, antialias: false });
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
    const pal = light ? PALETTES.light : PALETTES.dark;
    gl.uniform3fv(U("PC"), pal.cols.flatMap(hex));
    gl.uniform3fv(U("PS"), hex(pal.sheen));
    // Seeded so each mount's grain differs.
    gl.uniform1f(U("seed"), Math.random() * 1000);
    const uT = U("t");
    const uRes = U("res");

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    const ro = new ResizeObserver(([e]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(1, Math.round(e.contentRect.width * dpr));
      cv.height = Math.max(1, Math.round(e.contentRect.height * dpr));
      gl.viewport(0, 0, cv.width, cv.height);
      gl.uniform2f(uRes, cv.width, cv.height);
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
      ro.disconnect();
      io.disconnect();
    };
  }, [light]);

  return <canvas ref={ref} aria-hidden className={className ?? "absolute inset-0 block h-full w-full"} />;
}
