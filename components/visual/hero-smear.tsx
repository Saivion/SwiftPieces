"use client";
import { useEffect, useRef } from "react";

/**
 * The hero's spectral smear (Saivion, 2026-11-27): the pricing card's ember arcs (pink core, blush, orange,
 * red, wine) rising from behind the screens, their outer edge dragged into grainy streaks that split into a
 * fringe in the same pricing-card colours (pink, orange, red, wine) and fade into the page. One fragment shader on
 * a transparent canvas over the plain page, so the screens stand in front and both themes keep their ground.
 * The copy keeps a clear oval. The streaks flow on a seamless loop, it pauses off screen, and Reduce Motion
 * gets a still.
 *
 * `centre` places the arcs' origin as shares of the canvas; `scale` is the arcs' size in canvas heights;
 * `sdir` is the way the streaks trail (x, y down); `veil` is the clear oval round the copy, as shares.
 */
export type SmearVeil = { x: number; y: number; rx: number; ry: number };

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const RAMP = ["#ffc1d6", "#ffeae2", "#ff8a5c", "#f2361c", "#4a0a08"];
const SPEC = ["#ffc1d6", "#ff8a5c", "#f2361c", "#4a0a08"];
const STOPS = [0.555, 0.625, 0.672, 0.715, 0.8];
/** One loop of the streaks, in seconds. */
const LOOP = 9;

const VS = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;
const FS = `precision highp float;
uniform vec2 res,C,SDIR;uniform vec4 VEIL;uniform vec3 FADE;uniform float S,phase,dpr;
uniform float stops[5];uniform vec3 cols[5];uniform vec3 spec[4];
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*vnoise(p);p*=2.03;a*=.5;}return v;}
// ramp position 0..5 for a distance (5 = past the wine ring, the page)
float idxAt(float d,float w){float t=0.;for(int i=0;i<5;i++){float e=stops[i]+(i==0?-.06:(i>=3?.03:0.));t+=smoothstep(e-w,e+w,d);}return t;}
vec3 rampAt(float t){vec3 c=cols[0];for(int i=0;i<4;i++){c=mix(c,cols[i+1],clamp(t-float(i),0.,1.));}return c;}
float alphaAt(float t){return 1.-clamp(t-4.,0.,1.);}
vec3 specAt(float u){u=clamp(u,0.,1.)*3.;vec3 r=spec[0];for(int i=0;i<3;i++){r=mix(r,spec[i+1],clamp(u-float(i),0.,1.));}return r;}
void main(){
  vec2 px=vec2(gl_FragCoord.x,res.y-gl_FragCoord.y);
  float PH=6.28318*phase;
  // the arcs: distance from a slowly swaying origin, in arc units
  vec2 cc=(C+vec2(.025*sin(PH),.012*sin(2.*PH+1.)))*res;
  // sized off the canvas height, so the arcs meet the screens at the same place on every width
  vec2 q=(px-cc)/(res.y*S);
  float d=length(q);
  float w=.085;
  // streak space in css px, so the streaks keep their size on any window
  vec2 p=px/dpr/770.;
  vec2 dv=normalize(SDIR),pv=vec2(-dv.y,dv.x);
  float al=dot(p,dv),ac=dot(p,pv);
  vec2 lo2=vec2(cos(PH),sin(PH));
  float st=fbm(vec2(ac*15.,al*1.3)+lo2*.55)*.85+fbm(vec2(ac*42.+4.,al*2.5)+lo2*.9)*.15;
  float zone=smoothstep(stops[0]-.05,stops[2],d);
  float drag=max(dot(normalize(q+1e-5),dv),0.);
  float dd=d+zone*((st-.45)*.22+.10*drag*st);
  // a chromatic split across the rings
  float ca=.022;
  vec3 col=vec3(rampAt(idxAt(dd-ca,w)).r,rampAt(idxAt(dd,w)).g,rampAt(idxAt(dd+ca,w)).b);
  float A=alphaAt(idxAt(dd,w));
  // the spectral fringe across the bright-to-dark run, sprayed as grain
  float lo=stops[1]-.04,hi=stops[4]+.09+.06*drag;
  float u=(dd-lo)/(hi-lo);
  float j=hash(floor(px/(1.4*dpr))+floor(phase*240.)*7.13)-.5;
  float amt=pow(clamp(sin(3.14159*clamp(u,0.,1.)),0.,1.),.7)*(.55+.7*st);
  amt=clamp(amt,0.,.92);
  col=mix(col,specAt(u+j*.22),amt);
  A=mix(A,1.,amt);
  float fade=1.-smoothstep(.72,1.05,u+j*.35);
  A*=mix(1.,fade,smoothstep(.5,.9,u));
  col+=j*.07*zone;
  // the clear oval round the copy
  vec2 e=(px-VEIL.xy*res)/(VEIL.zw*res);
  A*=smoothstep(.75,1.25,length(e));
  // fade in under the top edge and out before the bottom one, so nothing stops at a line
  A*=smoothstep(0.,90.*dpr,px.y);
  float from=FADE.z+(FADE.y-FADE.z)*clamp(FADE.x/1000.,.4,1.);
  A*=1.-smoothstep(res.y-from*dpr,res.y-FADE.z*dpr,px.y);
  A=clamp(A,0.,1.);
  gl_FragColor=vec4(clamp(col,0.,1.)*A,A);
}`;

export function HeroSmear({
  centre = [0.5, 1],
  scale = 0.75,
  sdir = [0.35, -1],
  veil = { x: 0.5, y: 0.3, rx: 0.34, ry: 0.15 },
  fade = [320, 160],
  className,
}: {
  centre?: [number, number];
  scale?: number;
  sdir?: [number, number];
  veil?: SmearVeil;
  /** Fade out from this many css px above the canvas's bottom edge to this many. */
  fade?: [number, number];
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [cx, cy] = centre;
  const [sx, sy] = sdir;
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
    gl.uniform2f(U("SDIR"), sx, sy);
    gl.uniform1f(U("S"), scale);
    const uVeil = U("VEIL");
    gl.uniform1fv(U("stops"), STOPS);
    gl.uniform3fv(U("cols"), RAMP.flatMap(hex));
    gl.uniform3fv(U("spec"), SPEC.flatMap(hex));
    const uPhase = U("phase");
    const uRes = U("res");
    const uDpr = U("dpr");
    const uFade = U("FADE");

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let visible = true;
    const t0 = performance.now();
    const draw = (now: number) => {
      gl.uniform1f(uPhase, reduced ? 0 : (((now - t0) / 1000) % LOOP) / LOOP);
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
      gl.uniform1f(uDpr, cv.width / Math.max(e.contentRect.width, 1));
      // on phones the copy spans the screen, so the clear oval does too
      const narrow = e.contentRect.width < 640;
      gl.uniform4f(uVeil, narrow ? 0.5 : vx, vy, narrow ? Math.max(vrx, 0.62) : vrx, vry);
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
      ro.disconnect();
      io.disconnect();
    };
  }, [cx, cy, sx, sy, scale, vx, vy, vrx, vry, fadeFrom, fadeTo]);

  return <canvas ref={ref} aria-hidden className={className ?? "pointer-events-none absolute inset-x-0 -top-[var(--nav-h)] z-0 block h-[calc(100%+var(--nav-h)+160px)] w-full"} />;
}
