import { useEffect } from "react";

interface SeoOptions {
  title: string;
  description?: string;
  canonicalPath?: string;
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useSeo({ title, description, canonicalPath }: SeoOptions) {
  useEffect(() => {
    document.title = title;
    if (description) {
      upsertMeta("name", "description", description);
      upsertMeta("property", "og:description", description);
    }
    upsertMeta("property", "og:title", title);
    if (canonicalPath) {
      const url = `${window.location.origin}${canonicalPath}`;
      upsertLink("canonical", url);
      upsertMeta("property", "og:url", url);
    }
  }, [title, description, canonicalPath]);
}
