import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { appBySlug, apps } from "@/lib/apps";
import { AppPlaygroundPage, appPlaygroundMetadata, buildApp } from "@/lib/playground-page";

type Params = { app: string };

/** One Playground per app in the library, built at build time. */
export const dynamicParams = false;
export function generateStaticParams(): Params[] {
  return apps.map((a) => ({ app: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const a = appBySlug((await params).app);
  return a ? appPlaygroundMetadata(a) : {};
}

export default async function AppPlayground({ params }: { params: Promise<Params> }) {
  const a = appBySlug((await params).app);
  if (!a) notFound();
  const { project, stepTitles } = await buildApp(a);
  return <AppPlaygroundPage app={a} project={project} stepTitles={stepTitles} />;
}
