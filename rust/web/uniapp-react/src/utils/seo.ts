export interface PageMetaOptions {
    title?: string;
    description?: string;
    keywords?: string;
    image?: string;
    url?: string;
    type?: string;
    robots?: string;
}

const IS_H5 = process.env.TARO_ENV === "h5";

export function setMetaTag(attr: string, key: string, content: string): void {
    if (!IS_H5) return;
    let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
    if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    el.setAttribute("content", content);
}

function setLinkTag(rel: string, href: string): void {
    if (!IS_H5) return;
    let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
    if (!el) {
        el = document.createElement("link");
        el.rel = rel;
        document.head.appendChild(el);
    }
    el.href = href;
}

function getCanonicalUrl(url?: string): string {
    if (!IS_H5) return url || "";
    const raw = url || window.location.href;
    try {
        const u = new URL(raw);
        const allowedParams = ["id"];
        const cleaned = new URLSearchParams();
        for (const key of allowedParams) {
            if (u.searchParams.has(key)) {
                cleaned.set(key, u.searchParams.get(key)!);
            }
        }
        u.search = cleaned.toString();
        return u.toString();
    } catch {
        return raw;
    }
}

export function setPageMeta(options: PageMetaOptions): void {
    if (!IS_H5) return;
    const { title, description, keywords, image, url, type, robots } = options;

    if (title) {
        document.title = title;
    }

    if (description) {
        setMetaTag("name", "description", description);
    }

    if (keywords) {
        setMetaTag("name", "keywords", keywords);
    }

    if (title) {
        setMetaTag("property", "og:title", title);
    }
    if (description) {
        setMetaTag("property", "og:description", description);
    }
    if (image) {
        setMetaTag("property", "og:image", image);
    }
    if (type) {
        setMetaTag("property", "og:type", type);
    }

    const canonicalUrl = getCanonicalUrl(url);
    setMetaTag("property", "og:url", canonicalUrl);
    setLinkTag("canonical", canonicalUrl);
}

export function setJsonLd(data: Record<string, any>): void {
    if (!IS_H5) return;
    const id = "seo-json-ld";
    let script = document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
        script = document.createElement("script");
        script.id = id;
        script.type = "application/ld+json";
        document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
}

export function clearJsonLd(): void {
    if (!IS_H5) return;
    const el = document.getElementById("seo-json-ld");
    if (el) {
        el.remove();
    }
}

export function extractDescription(html: string, maxLength: number = 150): string {
    if (!html) return "";
    const text = html
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}
